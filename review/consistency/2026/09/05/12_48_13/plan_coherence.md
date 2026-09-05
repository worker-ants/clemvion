# Plan 정합성 검토 — `spec/5-system/` (impl-prep)

## 검토 방법

`spec/5-system/` 17개 파일의 frontmatter(`status`/`pending_plans`)를 전수 추출해 각 파일이
가리키는 `plan/in-progress/**` 항목을 대조하고, `plan/in-progress/**` 전체에서
`5-system` 을 참조하는 파일(30여 개)을 grep 으로 찾아 미해결 결정(`- [ ]`, "결정 필요",
"미결", "보류" 등)이 target 문서의 현재 서술과 충돌하는지 개별 확인했다. 프롬프트 번들이
예산 초과로 생략한 14개 파일(`4-execution-engine.md`·`6-websocket-protocol.md`·
`14-external-interaction-api.md` 등)은 저장소에서 직접 `Read`/`grep` 해 판정했다.

## 발견사항

- **[WARNING] `spec-conventions-engine-error-code-surface.md` 의 잔여 체크리스트 항목이 이미 해소된 target 상태를 그대로 지목**
  - target 위치: `spec/5-system/3-error-handling.md` §1.4 (엔진 수준 에러 표 — "앵커" 열 및
    도입부 blockquote), `spec/1-data-model.md:474` (`Execution.error` 6종 등재처 서술)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 미체크
    항목 `- [ ] 잔여 (developer 트랙) — error-codes.ts EngineErrorCode JSDoc 의 이분법
    프레이밍` 아래 3개 하위 불릿 중 2개
  - 상세: 이 미체크 항목은 "같은 오독(두 surface 병기만으로 카탈로그가 다 설명된다는
    오해)을 계속 재생산하는 자리"로 `spec/1-data-model.md:474` 와
    `spec/5-system/3-error-handling.md §1.4` 를 나열한다. 그런데 **같은 plan 문서 바로 위의
    체크 완료 항목**("후속 — 인접 문서의 선재 drift: spec 쪽 2건 반영 완료 (2026-09-04)",
    `spec-draft-scope-and-anchor-drift.md ④` 참조)이 정확히 이 두 파일을 이미 고쳤다고
    기록한다. 실측 결과도 일치한다 — 현재 `3-error-handling.md` §1.4 표는 이미 "앵커" 열을
    갖고 각 코드를 `ErrorCode`/`EngineErrorCode`/클래스 `readonly code`/"없음" 4갈래로
    구분하며, 도입부 blockquote 가 "이 표는 단일 등재처를 뜻하지 않는다"고 명시적으로
    경고한다. `1-data-model.md:474` 역시 6종을 등재처별로 전부 구분해 서술한다. 즉 미체크
    항목이 지목한 3곳 중 2곳은 **이미 해소**됐고, 실제로 남은 것은
    `codebase/backend/src/nodes/core/error-codes.ts` 의 `EngineErrorCode` JSDoc(122번째
    줄, `"엔진 레이어" 에러 코드` 프레이밍)뿐임을 코드에서 직접 확인했다 — 이 한 곳만
    여전히 이분법 프레이밍을 유지한다.
  - 제안: plan 쪽을 갱신한다 — 해당 불릿에서 두 spec 파일 하위 항목을 제거하거나
    "해소됨 — `spec-draft-scope-and-anchor-drift.md ④` 참조"로 갱신하고, 잔여 범위를
    `error-codes.ts` JSDoc 한 곳으로 좁힌다. 이대로 두면 이 항목을 다시 여는 developer 가
    이미 고쳐진 spec 두 곳을 재차 편집 시도해 중복 작업이나 불필요한 diff 를 만들 위험이
    있다.

- **[INFO] `status: implemented` 인 두 5-system spec 이 `pending_plans:` 를 비우지 않음**
  - target 위치: `spec/5-system/10-graph-rag.md`, `spec/5-system/8-embedding-pipeline.md`
    frontmatter
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` (아직 in-progress)
  - 상세: `spec/conventions/spec-impl-evidence.md §3` 라이프사이클 표는 `status:
    implemented` 일 때 `pending_plans:` 를 "없음"으로 규정한다. 그러나 두 파일 모두
    `status: implemented` 이면서 `pending_plans:` 에 `update-returning-tuple-shape.md`
    (10-graph-rag.md 는 추가로 마이그레이션 SQL 파일 경로 3개까지)를 계속 나열한다.
    `spec-status-lifecycle.test.ts` 는 `implemented`/`archived` 상태에는 이 검증을 하지
    않으므로(코드 주석 "lifecycle guard idle") 빌드는 깨지지 않지만, 문서화된 규약과
    실제 frontmatter 사용이 어긋난다. `pending_plans:` 필드의 정의("미구현 surface 를
    책임지는 plan 경로")와 달리 마이그레이션 SQL 파일 경로를 섞어 넣은 것도 스키마 오용
    소지가 있다. 다만 이는 target-vs-plan 내용 충돌이 아니라 빌드 가드가 놓치는 문서
    규약 drift 라 이 checker 의 1차 관심사(미해결 결정 충돌·선행 plan 미해소·후속 항목
    누락)에는 부합하지 않는 부수 관찰이다.
  - 제안: 두 파일의 `pending_plans:` 를 비우거나(구현 완료를 정확히 반영), 이 필드가
    "구현 완료 후에도 남는 cross-cutting 코드 품질 추적"용으로 허용되는지
    `spec-impl-evidence.md §3` 에 명시적 예외를 추가한다. `update-returning-tuple-shape.md`
    완료(`plan/complete/` 이동) 시 이 정리를 빠뜨리기 쉬우므로 그 plan 의 후속 항목으로
    등재 권장.

## 점검했으나 충돌 없음으로 판정한 항목 (참고)

- `chat-channel-discord-gateway.md`/`chat-channel-slack-socket-mode.md` 의 "사용자 결정
  필요" 미해결 항목(WebSocket 인프라 도입·R-D-3/R-S-3 기각 결정 번복)은 target
  `15-chat-channel.md` R-CC-13 이 여전히 "Discord v1 Gateway 도입 안은 R-D-3 기각 사유가
  그대로 적용된다"고 명시해 미결 상태를 그대로 반영 — 충돌 없음.
  `spec-sync-chat-channel-gaps.md`/`exec-intake-followups.md` 가 `plan/complete/` 로
  이동됐음에도 `15-chat-channel.md`/`4-execution-engine.md` frontmatter 의 `pending_plans:`
  에 여전히 남아 있는 것도 `spec-pending-plan-existence.test.ts` 가 `in-progress/`·
  `complete/` 양쪽을 모두 인정하도록 설계돼 있어(§3 "모든 pending_plans 가 complete 로
  이동하면 승격" 규칙과 일치, 이 그룹은 아직 형제 항목이 남아 전원 이동이 아님) 정상
  상태로 판정.
- `spec-sync-auth-gaps.md` 의 `login_history` 감사 강도 미결·LDAP/SAML §1.3 미구현 등은
  target `1-auth.md` 가 "별개 결정으로 범위 밖"/"미구현 · Planned" 로 정확히 caveat 해
  일치.
- `execution-engine-residual-gaps.md` G1(철회)/G2(defer 확정)는 target
  `4-execution-engine.md` §11 이 Phase 1 범위(errorPolicy 분기 없음)를 명시적으로
  caveat 하고 있어 일치. G3 는 이미 구현·spec 반영 완료.
- `spec-draft-nullable-notation-followups.md` (§2.2 `/api/auth/*` 예외, §5.4 DTO 선언
  3갈래 규칙)는 이미 `spec/5-system/2-api-convention.md` §2.2/§5.4 에 그대로 반영돼
  있음을 확인 — 잔여 항목(§5.4 drift 배치 2단계 78곳, Flyway `mixed=true` 결정, bare
  인용 8건)은 target 과 충돌 없이 정확히 "아직 미착수"로 등재돼 있음.
- `eia-terminal-payload.md`/`spec-draft-eia-62-waiting-payload.md`/
  `spec-draft-eia-notification-payload-contract.md` 는 `status: in-progress` 이나
  실제로는 잔여 미체크 항목(외부 유출 대응 운영 판단, `result.outputs` 후속, 필드명
  통일 등)이 정당하게 남아 있어 `plan/complete/` 미이동이 규약 위반이 아님.
  (자매 plan 이 서로의 완료를 못 보는 위험은 각 문서가 이미 스스로 기록·경계했다.)

## 요약

`spec/5-system/` 17개 파일과 이를 참조하는 `plan/in-progress/**` 30여 개 문서를 대조한
결과, target 이 plan 의 미해결 결정을 우회하거나 선행 조건을 무시한 사례(CRITICAL 급)는
발견되지 않았다 — 특히 chat-channel Gateway/Socket Mode, auth 감사 강도, execution-engine
G1/G2 등 굵직한 "사용자 결정 필요" 항목은 target 문서가 정확히 미결 상태를 caveat 하고
있어 일관성이 유지된다. 다만 `spec-conventions-engine-error-code-surface.md` 의 잔여
체크리스트 한 항목이 같은 문서 안에서 이미 완료로 기록된 spec 수정 2건을 여전히 "미해소"로
지목하고 있어(WARNING), 다음 착수자가 중복 작업을 할 위험이 있다. 부수적으로 `status:
implemented` spec 2건이 관례상 비어야 할 `pending_plans:` 를 유지하는 문서 규약 drift도
확인했다(INFO). 전반적으로 이 repo 의 plan/spec 동기화 관행은 촘촘하게 관리되고 있다.

## 위험도

LOW
