# Rationale 연속성 검토 — spec/conventions/spec-impl-evidence.md (draft)

## 방법 메모

프롬프트에 번들된 "관련 Rationale 발췌"는 대부분 `spec/3-workflow-editor/4-ai-assistant.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/{2-sdk,3-auth-session,4-security}.md`
등 target(=`spec/conventions/spec-impl-evidence.md`, frontmatter/build-gate 컨벤션)과 도메인이
전혀 겹치지 않는 문서였고, 나머지 대다수는 "컨텍스트 예산 초과로 본문 생략" 표식만 있어 실질적으로
비교 불가했다. 이 draft 와 진짜로 관련 있는 SoT — `.claude/docs/plan-lifecycle.md`, 그리고
draft 가 근거로 삼는 실제 가드 구현(`spec-plan-completion.test.ts`, `plan-link-integrity.test.ts`)
— 를 직접 열어 대조했다.

또한 target 은 아직 디스크에 쓰이지 않은 draft(현재 `spec/conventions/spec-impl-evidence.md` 는
5건이 아니라 4건 build 가드 상태로 clean)이고, 이 draft 가 문서화하려는 가드 코드 자체는 이미
`developer` 턴(HEAD `62084e807`)에서 구현·커밋되어 있다(`spec/` 는 developer 쓰기 금지라 spec
갱신만 이 세션의 몫). `plan/in-progress/spec-draft-secret-store-verification-footnote.md` 의
"후속" 절 실측 기록과 draft 의 R-11 수치가 정확히 일치함을 확인했다 — 사실관계 자체는 신뢰할 만하다.

## 발견사항

- **[WARNING]** plan `status:` 값 어휘가 spec `status:` enum 과 리터럴이 겹치는데 §2.2 "의미 도메인 구분"에 미등재
  - target 위치: §4.2 표 `spec-plan-completion.test.ts` (**2번째 invariant**) 행, 및 근거로 삼는 R-11(a)
  - 과거 결정 출처: target 자신의 §2.2 "의미 도메인 구분 (혼동 방지)" + Rationale **R-4** (`archived` vs cafe24 `deprecated` 를 "의미 도메인이 다름"으로 명시 분리한 선례), 그리고 §2.2 의 기존 두 번째 항목("`status:` 키 — entity status 컬럼과는 레이어가 다름")
  - 상세: 이번 draft 가 §4.2 규약 SoT 로 새로 명문화하는 `plan/complete/**` frontmatter `status:` 값 도메인(R-11a 실측: `complete`/`applied`/`implemented`/`superseded`=완료 어휘, `in-progress`/`backlog`=미완 어휘)은 spec frontmatter `status:` 5값 enum(§3: `backlog`/`spec-only`/`partial`/`implemented`/`archived`)과 **`backlog`, `implemented` 두 리터럴이 문자 그대로 겹친다.** §2.2 는 정확히 이런 "같은 표현·다른 레이어" 문제를 예방하려고 만들어진 절이고, 이미 entity `status` 컬럼과 cafe24 `deprecated` 두 건을 등재해온 확립된 패턴(R-4 가 명시적으로 근거를 남김)인데, 이번에 새로 build-gate 로 강제되는 plan `status:` 값 도메인은 이 절에 등재되지 않았다. `status: backlog`, `status: implemented` 라는 문자열만 보고는 이게 spec 문서인지 plan 문서인지, 어느 가드(§4 `spec-status-lifecycle` vs §4.2 `spec-plan-completion` 2번째 invariant)가 적용되는지 즉시 판단할 수 없다는 점에서 §2.2 가 원래 막으려던 혼동과 같은 종류다.
  - 제안: §2.2 에 세 번째 항목을 추가 — "plan frontmatter 의 `status:` 값(예: `in-progress`/`backlog`/`complete`/`applied`/`implemented`/`superseded`, 규약 SoT = [plan-lifecycle §4](../../.claude/docs/plan-lifecycle.md) 및 본 문서 §4.2)은 spec `status:` enum(§3)과 `backlog`/`implemented` 리터럴이 겹치지만 레이어가 다르다 — `spec-plan-completion.test.ts` 2번째 invariant 는 plan frontmatter 만 검사하고 spec `status:` enum 판정에는 관여하지 않는다." R-4 와 같은 형식으로 한 문단이면 충분.

- **[INFO]** §4.2 가드 개수(4→5) 갱신이 R-9(a)·§6 Rollout 서술까지 동기화되지 않음
  - target 위치: §4.2 도입부(이미 "build 차단 **5**건 + advisory 1건"으로 갱신됨) vs §6 Rollout 정책 3번 항목("frontmatter-evidence 가드(§4, 현재 4건) + §4.2 ... (build **4**건 + advisory Gate D)") vs Rationale **R-9(a)**("가드 **4**건에 새 spec 파일은 과하고 ...")
  - 과거 결정 출처: target 자신의 Rationale R-9 — "SoT 를 본 문서로 택한 이유 vs 기각 대안" 판단이 명시적으로 "가드 4건" 이라는 **수치를 근거**로 "별도 convention 문서로 분리하기엔 과하다"는 결론을 냄
  - 상세: 이 draft 는 §4.2 표에 5번째 build 가드(`plan-link-integrity.test.ts`)와 `spec-plan-completion.test.ts` 두 번째 invariant를 추가하면서 §4.2 도입 문장의 "4건"은 "5건"으로 정확히 갱신했다. 그런데 같은 정보를 반복 서술하는 §6 Rollout 3번 항목과 R-9(a)는 그대로 "4건"을 주장해 문서 내부에서 두 값이 충돌한다. R-9(a)의 "4건"은 단순 스타일 서술이 아니라 "가드 수가 적어 별도 문서 분리가 과하다"는 **판단의 근거 수치**였으므로, 다음에 이 판단(별도 문서로 쪼갤지)을 재검토할 사람이 문서 내에서 서로 다른 값을 보면 어느 쪽이 최신인지 혼란을 겪는다. 부수적으로 R-9(b)("link/area-index 는 spec 도메인이라 부적합")도 신설된 `plan-link-integrity.test.ts`(plan 도메인 link 가드)로 인해 "link" 가 더 이상 spec 전유물이 아니게 됐는데 문구는 갱신되지 않았다. 다만 이건 결론(§4.2 에 계속 묶어 두는 것)을 뒤집을 사안은 아니라 정합성 보완 수준이다.
  - 제안: §6 3번 항목의 "build 4건"을 "build 5건"으로, R-9(a)의 "가드 4건"을 "가드 5건" 또는 "가드는 계속 늘어 지금은 5건"으로 동기화한다. R-9(b)에는 "plan-link-integrity 신설로 link 가드가 spec/plan 양쪽에 존재하게 됐다"는 한 문장을 보태면 향후 family 경계를 재검토할 때 최신 상태를 정확히 반영한다.

## 검토했으나 문제 없다고 판단한 항목 (참고용)

- **Gate C grandfather(R-8) vs 신설 2번째 invariant 의 grandfather 없음**: R-11(a)가 "새 필드를 요구하는 게 아니라 기존 필드가 자기 위치와 모순되는 상태라 소급 면제 대상이 아니다"로 명시적 근거를 남기며 R-8 패턴에서 의도적으로 벗어난다 — "결정의 무근거 번복"에 해당하지 않음(새 Rationale 동반).
- **원 티켓의 "`complete` 여야 한다" 규칙 기각**: R-11(a)가 실측(241개 RED, `superseded` 정보 소실 등)으로 명시적으로 기각 사유를 남기고, 채택된 규칙(`claimsUnfinished`)이 그 기각을 다시 뒤집지 않음 — 기각된 대안 재도입 없음.
- **plan-link-integrity 의 ratchet 채택**: "기각한 대안: 76건 일괄 정정"을 R-11(b)에 명시. 이미 §4.2 `spec-link-integrity` 는 non-ratchet(즉시 차단)인데 이 가드만 ratchet 인 것은 corpus 상태(spec/**는 이미 clean, plan/**는 76건 위반)가 다르다는 근거가 있어 모순이 아님.
- **§4.2 family 분류(spec frontmatter 아님)**: R-11(c)가 R-9 의 family 경계를 그대로 인용해 정합성 유지.
- **수치 상호검증**: `plan-link-integrity.test.ts` 실제 `KNOWN_BROKEN` 및 주석의 "76건→고유 61쌍→5건 정정→56쌍 동결" 서술이 R-11(b)·plan 문서의 실측과 정확히 일치.

## 요약

target draft 는 이미 구현·커밋된 가드 코드를 spec 문서에 사후 반영하는 catch-up 성격의 작업이며,
과거 Rationale(R-1~R-10)이 기각한 대안을 다시 채택하거나 §4.2 family 경계·grandfather 패턴 같은
합의된 설계 원칙을 근거 없이 어기는 지점은 발견되지 않았다. 오히려 원 티켓이 제안한 규칙("`complete`
여야 한다", "즉시 켠다")을 실측으로 명시적으로 기각하고 새 Rationale(R-11)을 충실히 남기는, 이
저장소가 요구하는 패턴을 정확히 따르고 있다. 다만 §4.2 가드 개수를 4→5로 올리면서 같은 문서 안의
다른 두 서술(R-9(a), §6 Rollout)을 갱신하지 않아 내부 수치가 불일치하는 점, 그리고 새로 SoT 화되는
plan `status:` 값 어휘가 spec `status:` enum 과 `backlog`/`implemented` 리터럴을 공유함에도 §2.2
의미 도메인 구분 절에 등재되지 않은 점은 이 문서 자신이 세운 원칙(R-4, R-9)의 적용 누락으로 볼 수
있어 반영을 권한다.

## 위험도

LOW
