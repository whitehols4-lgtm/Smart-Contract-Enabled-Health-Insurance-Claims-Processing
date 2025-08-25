;; fraud-detection.clar
;; Sophisticated Fraud Detection Smart Contract for Health Insurance Claims Processing
;; Analyzes claims for potential fraud using configurable rules, anomaly scoring, and pattern analysis.
;; Integrates with PatientRegistry and ClaimSubmission contracts to ensure data integrity.

;; Constants
(define-constant ERR-UNAUTHORIZED (err u300))
(define-constant ERR-INVALID-RULE (err u301))
(define-constant ERR-CLAIM-NOT-FOUND (err u302))
(define-constant ERR-PATIENT-NOT-FOUND (err u303))
(define-constant ERR-INVALID-SCORE (err u304))
(define-constant ERR-INVALID-PARAMETER (err u305))
(define-constant ERR-RULE-EXISTS (err u306))
(define-constant MAX-RULES u10) ;; Max fraud detection rules
(define-constant MAX-CLAIMS-PER-PERIOD u5) ;; Max claims per patient in a time window
(define-constant TIME-WINDOW u1440) ;; ~1 day in blocks (assuming 10-min blocks)
(define-constant MAX-NOTES-LENGTH u200) ;; Max length for fraud report notes
(define-constant ADMIN principal) ;; Deployer is admin (simplified for example)

;; Data Maps
(define-map fraud-rules
  { rule-id: uint }
  {
    name: (string-ascii 50),
    max-claims: uint, ;; Max claims per patient in time window
    min-amount: uint, ;; Min claim amount to trigger rule
    max-amount: uint, ;; Max claim amount to trigger rule
    weight: uint, ;; Weight for anomaly score
    active: bool
  }
)

(define-map claim-flags
  { claim-id: (buff 32) }
  {
    patient-id: (buff 32),
    score: uint, ;; Anomaly score (0-1000)
    status: (string-ascii 20), ;; "pending", "flagged", "cleared"
    notes: (string-utf8 200),
    timestamp: uint,
    reviewer: (optional principal) ;; Optional reviewer for manual checks
  }
)

(define-map patient-claim-count
  { patient-id: (buff 32), window-start: uint }
  {
    count: uint,
    last-claim-timestamp: uint
  }
)

;; External contract references (assumed deployed)
(define-constant PATIENT-REGISTRY-CONTRACT .patient-registry)
(define-constant CLAIM-SUBMISSION-CONTRACT .claim-submission)

;; Private Functions
(define-private (is-admin (caller principal))
  (is-eq caller ADMIN)
)

(define-private (is-valid-status (status (string-ascii 20)))
  (or
    (is-eq status "pending")
    (is-eq status "flagged")
    (is-eq status "cleared")
  )
)

(define-private (emit-event (event-type (string-ascii 32)) (data (tuple (key (string-ascii 32)) (value (string-utf8 256)))))
  (print { event: event-type, data: data })
)

(define-private (check-patient-exists (patient-id (buff 32)))
  (is-ok (contract-call? PATIENT-REGISTRY-CONTRACT get-current-version patient-id))
)

(define-private (get-claim-amount (claim-id (buff 32)))
  (match (contract-call? CLAIM-SUBMISSION-CONTRACT get-claim claim-id)
    claim (ok (get amount claim))
    ERR-CLAIM-NOT-FOUND
  )
)

(define-private (calculate-anomaly-score
  (claim-id (buff 32))
  (patient-id (buff 32))
  (amount uint)
)
  (let
    (
      (claim-count (get-claim-count patient-id))
      (score
        (fold calculate-rule-score
          (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10) ;; Up to MAX-RULES
          u0
        )
      )
    )
    (if (> score u1000) u1000 score) ;; Cap score at 1000
  )
)

(define-private (calculate-rule-score (rule-id uint) (current-score uint))
  (match (map-get? fraud-rules { rule-id: rule-id })
    rule
      (if (get active rule)
        (let
          (
            (claim-count (get-claim-count patient-id))
            (claim-amount (unwrap! (get-claim-amount claim-id) current-score))
          )
          (+ current-score
            (if (and
                  (>= claim-count (get max-claims rule))
                  (>= claim-amount (get min-amount rule))
                  (<= claim-amount (get max-amount rule)))
              (get weight rule)
              u0
            )
          )
        )
        current-score
      )
    current-score
  )
)

(define-private (get-claim-count (patient-id (buff 32)))
  (let
    (
      (window-start (- block-height TIME-WINDOW))
      (count-entry (map-get? patient-claim-count { patient-id: patient-id, window-start: window-start }))
    )
    (if (is-some count-entry)
      (get count count-entry)
      u0
    )
  )
)

;; Public Functions

;; Add a new fraud detection rule (admin only)
(define-public (add-rule
  (rule-id uint)
  (name (string-ascii 50))
  (max-claims uint)
  (min-amount uint)
  (max-amount uint)
  (weight uint)
)
  (begin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    (asserts! (> (len name) u0) ERR-INVALID-RULE)
    (asserts! (> max-claims u0) ERR-INVALID-RULE)
    (asserts! (<= rule-id MAX-RULES) ERR-INVALID-RULE)
    (asserts! (> weight u0) ERR-INVALID-RULE)
    (asserts! (<= weight u500) ERR-INVALID-RULE) ;; Cap weight to avoid score overflow
    (asserts! (is-none (map-get? fraud-rules { rule-id: rule-id })) ERR-RULE-EXISTS)
    (map-set fraud-rules
      { rule-id: rule-id }
      {
        name: name,
        max-claims: max-claims,
        min-amount: min-amount,
        max-amount: max-amount,
        weight: weight,
        active: true
      }
    )
    (emit-event "rule-added" { key: "rule-id", value: (as-max-len? (to-consensus-buff? rule-id) u256) })
    (ok true)
  )
)

;; Disable a fraud rule (admin only)
(define-public (disable-rule (rule-id uint))
  (let
    (
      (rule-opt (map-get? fraud-rules { rule-id: rule-id }))
    )
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    (asserts! (is-some rule-opt) ERR-INVALID-RULE)
    (map-set fraud-rules
      { rule-id: rule-id }
      (merge (unwrap! rule-opt ERR-INVALID-RULE) { active: false })
    )
    (emit-event "rule-disabled" { key: "rule-id", value: (as-max-len? (to-consensus-buff? rule-id) u256) })
    (ok true)
  )
)

;; Analyze a claim for fraud
(define-public (analyze-claim
  (claim-id (buff 32))
  (patient-id (buff 32))
)
  (let
    (
      (claim-opt (contract-call? CLAIM-SUBMISSION-CONTRACT get-claim claim-id))
      (patient-exists (check-patient-exists patient-id))
      (claim-amount (unwrap! (get-claim-amount claim-id) ERR-CLAIM-NOT-FOUND))
      (score (calculate-anomaly-score claim-id patient-id claim-amount))
      (window-start (- block-height TIME-WINDOW))
      (current-count (get-claim-count patient-id))
    )
    (asserts! (is-ok claim-opt) ERR-CLAIM-NOT-FOUND)
    (asserts! patient-exists ERR-PATIENT-NOT-FOUND)
    (asserts! (<= score u1000) ERR-INVALID-SCORE)
    (map-set claim-flags
      { claim-id: claim-id }
      {
        patient-id: patient-id,
        score: score,
        status: (if (>= score u700) "flagged" "pending"), ;; Flag if score >= 700
        notes: "Automated fraud analysis",
        timestamp: block-height,
        reviewer: none
      }
    )
    (map-set patient-claim-count
      { patient-id: patient-id, window-start: window-start }
      {
        count: (+ current-count u1),
        last-claim-timestamp: block-height
      }
    )
    (emit-event "claim-analyzed" { key: "claim-id", value: (as-max-len? (to-consensus-buff? claim-id) u256) })
    (ok score)
  )
)

;; Manually review and update flag status (admin only)
(define-public (review-claim
  (claim-id (buff 32))
  (new-status (string-ascii 20))
  (notes (string-utf8 200))
)
  (let
    (
      (flag-opt (map-get? claim-flags { claim-id: claim-id }))
    )
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    (asserts! (is-some flag-opt) ERR-CLAIM-NOT-FOUND)
    (asserts! (is-valid-status new-status) ERR-INVALID-STATUS)
    (asserts! (<= (len notes) MAX-NOTES-LENGTH) ERR-INVALID-PARAMETER)
    (map-set claim-flags
      { claim-id: claim-id }
      (merge (unwrap! flag-opt ERR-CLAIM-NOT-FOUND)
        {
          status: new-status,
          notes: notes,
          timestamp: block-height,
          reviewer: (some tx-sender)
        }
      )
    )
    (emit-event "claim-reviewed" { key: "claim-id", value: (as-max-len? (to-consensus-buff? claim-id) u256) })
    (ok true)
  )
)

;; Read-Only Functions

;; Get fraud rule details
(define-read-only (get-rule (rule-id uint))
  (map-get? fraud-rules { rule-id: rule-id })
)

;; Get claim flag status
(define-read-only (get-claim-flag (claim-id (buff 32)))
  (map-get? claim-flags { claim-id: claim-id })
)

;; Get patient claim count in current window
(define-read-only (get-patient-claim-count (patient-id (buff 32)))
  (let
    (
      (window-start (- block-height TIME-WINDOW))
      (count-entry (map-get? patient-claim-count { patient-id: patient-id, window-start: window-start }))
    )
    (ok (if (is-some count-entry)
          (get count count-entry)
          u0))
  )
)

;; Check if claim is flagged
(define-read-only (is-claim-flagged (claim-id (buff 32)))
  (match (get-claim-flag claim-id)
    flag (ok (is-eq (get status flag) "flagged"))
    (ok false)
  )
)