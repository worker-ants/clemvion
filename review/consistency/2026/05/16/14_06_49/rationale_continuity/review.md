# Rationale 연속성 검토 — Cafe24 HMAC 알고리즘 재정정

검토 대상: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-16

---

### 발견사항

- **[INFO]** PR #67 SEC H-1 번복 — 새 Rationale 동반 여부 확인
  - target 위치: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 변경 1 (§9.8 알고리즘 본문 정정) + 변경 3 (Rationale 신규 항)
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 코드 블록 주석 (line 435-438) 및 `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG (line 497) "PR #67 SEC H-1"
  - 상세: 현행 §9.8 spec 은 PR #67 SEC H-1 이 결정한 "`formUrlEncode` (Java URLEncoder 호환, 공백 `+`)" 알고리즘이 기재되어 있다. target 은 이를 "raw URL-encoded 값 보존 (decode/re-encode 금지)" 으로 번복한다. 그러나 target 은 이 번복을 단독으로 수행하지 않고 변경 3 에서 `spec/2-navigation/4-integration.md ## Rationale` 에 신규 항 "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 을 명시적으로 추가하며, 번복 근거(공식 Java 샘플 `validationCheckHmac` 의 `request.getQueryString()` split → TreeMap raw 저장), 운영 재현 증거(사용자 URL `user_name=%EB...%20...`), 기각된 대안(다양한 인코더 시도), 이론적 추론, 테스트 보강 계획, 관련 history(2026-05-14 최초 → 2026-05-16 SEC H-1 잘못된 번복 → 2026-05-16 본 재정정)를 모두 기술하고 있다.
  - 평가: 결정 번복에 새 Rationale 이 동반되어 있어 "무근거 번복" 에 해당하지 않는다. INFO 수준으로 분류.
  - 제안: target 의 변경 1 §9.8 본문 정정과 변경 3 Rationale 추가가 하나의 atomic 변경으로 스펙에 반영되어야 한다. 변경 2 CHANGELOG 행이 이를 연결하고 있으므로 세 변경이 함께 커밋되면 정합성이 유지된다.

- **[INFO]** 기각된 인코더 목록과 2026-05-14 최초 알고리즘(`encodeURIComponent`) 의 위치
  - target 위치: 변경 3 Rationale 항 "기각된 옵션" 단락
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 2026-05-14 항 ("§9.8 HMAC 검증 알고리즘 추가") 및 CHANGELOG 2026-05-16 항 ("PR #67 SEC H-1" 에서 `formUrlEncode` 로 정정)
  - 상세: target 의 "관련 history" 단락이 "2026-05-14: `encodeURIComponent` 사용, 운영 양호" 로 기술하지만, 현행 spec 의 CHANGELOG에는 2026-05-14의 최초 알고리즘 내용이 상세히 기재되어 있지 않다(§9.8 추가 사실만 명시). `encodeURIComponent` 가 "운영 양호"였다는 사실 및 SEC H-1 이 이를 깨뜨렸다는 인과 관계가 spec Rationale 본문에는 아직 존재하지 않는다. target 의 Rationale 신규 항이 이를 처음으로 명시화한다.
  - 평가: target 이 새 Rationale 에서 이 history 를 완전하게 서술하므로 정합성 결손은 apply 후 해소된다. 적용 전 현재 상태의 history gap 을 인지하는 차원의 INFO.
  - 제안: 별도 조치 불필요. 변경 3 이 적용되면 history 가 완결된다.

- **[INFO]** `tryRecoverByMallId` 와 "raw 값 보존" 알고리즘의 상호작용 명시 여부
  - target 위치: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 정합성 self-check 항
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" (line 1107-1120)
  - 상세: `tryRecoverByMallId` 회복 흐름은 HMAC trial 검증을 수행한다. HMAC 알고리즘이 바뀌면 이 회복 분기의 HMAC 검증도 동일한 새 알고리즘을 사용해야 한다. target 의 self-check 항은 "`buildHmacMessage` 시그니처 호환 — 호출자 (`handleInstall`, `tryRecoverByMallId`) 변경 불필요" 를 명시하여 두 경로가 같은 함수를 공유함을 확인했다. 따라서 알고리즘 변경이 `tryRecoverByMallId` 에도 자동으로 적용되는 구조이나, 이 연계를 spec Rationale 에 명시하면 향후 유지보수 혼동을 줄일 수 있다.
  - 평가: 구조적 정합성은 확보되어 있으며 위반이 아니다. 문서 명확성 보완 차원의 INFO.
  - 제안: 변경 3 의 Rationale 신규 항 또는 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 항에 "HMAC 알고리즘 재정정(raw 보존) 이 회복 분기에도 동일하게 적용됨 — `buildHmacMessage` 함수 공유 구조" 한 줄을 추가하면 완결된다.

---

### 요약

target 문서(`spec-draft-cafe24-hmac-raw-fix.md`)는 PR #67 SEC H-1 의 "`formUrlEncode` (Java URLEncoder 호환)" 결정을 "raw URL-encoded 값 보존" 으로 번복하는 내용을 담고 있다. 이 번복은 합의 원칙을 무시하거나 기각된 대안을 이유 없이 재도입하는 것이 아니라, 운영 재현 증거와 Cafe24 공식 Java 샘플 분석에 기반한 명시적 재정정이며, 변경 3 에서 신규 Rationale 항을 동시에 작성하고 있다. 기각된 옵션(다양한 인코더 시도) 도 Rationale 내에서 명시적으로 폐기 이유와 함께 기록되어 있다. Rationale 에 기록된 기존 invariant(단일 row 조회 + HMAC 1회 검증, capability-token 보안 전제, `tryRecoverByMallId` HMAC 검증 유지, `SECRET_LEAK_PATTERNS` 정책)는 모두 침해하지 않는다. 전반적으로 Rationale 연속성 관점에서 위반 사항이 없으며, 세 가지 INFO는 문서 완결성을 높이는 보완 제안이다.

### 위험도

NONE
