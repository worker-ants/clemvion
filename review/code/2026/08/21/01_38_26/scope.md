# 변경 범위(Scope) 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17, Manual 실행 경로)

## 검토 범위

`origin/main`(`b677564e0`) 대비 이 브랜치 전체 diff, 92개 파일. 실제 프로덕션 코드 변경은
9개 파일(`CHANGELOG.md` 포함)이고, 나머지는 `plan/**`·`review/code/**`(3라운드분: `00_03_57`·
`00_39_27`·`01_15_47`)·`review/consistency/**`(4라운드분)·`spec/**`(7개 파일) — 이 저장소
컨벤션상 `review/`·`plan/` 은 gitignore 대상이 아니고, 반복 리뷰-수정 루프의 산출물이 매
라운드 커밋에 실리는 것이 표준 워크플로다. 이 다건의 리뷰/컨시스턴시 산출물 자체는 "무관한
파일 수정"이 아니라 이 작업이 거쳐온 정규 절차의 흔적으로 판단해 스코프 위반으로 세지
않았다.

## 발견사항

- **[WARNING]** `fix(security)` 커밋(`50f799efd`)이 developer 턴에서 `spec/` 파일을 직접 수정 — CLAUDE.md 의 role 경계 위반 (이미 자체 발견·정정됨)
  - 위치: `spec/5-system/14-external-interaction-api.md` — 커밋 `50f799efd`(`git show --stat` 확인: `spec/5-system/14-external-interaction-api.md | 2 +-`, developer 턴 산출물인 `review/code/2026/08/21/00_03_57/**` 와 같은 커밋에 포함). 자체 보고 문서: `plan/complete/spec-update-masked-reject-framing.md` "⚠️ 절차 위반을 먼저 적는다 (W3)", `review/code/2026/08/21/00_39_27/RESOLUTION.md` "WARNING 3".
  - 상세: CLAUDE.md 는 `developer` 의 `spec/` 쓰기 권한을 명시적으로 read-only 로 규정하고 spec 변경은 `project-planner` 위임으로 못박는다. `git log -S`/`git show --stat` 로 실측하면 `spec/5-system/14-external-interaction-api.md` 의 §R17 표 행 라벨 변경(`서버 (재제출 API)` → `서버 (Manual 실행 경로)`)은 planner 커밋(`3e96f4b44`, `871d3fcb0`)이 아니라 `fix(security)` prefix 를 단 `50f799efd` 에서 처음 나타난다 — 즉 코드 fix 턴에서 spec 파일이 함께 수정됐다. 내용 자체는 리뷰어도 *"실질 리스크 낮음"* 으로 평가했고(표 행이 바로 아래 캐비엇과 일관되게 됨), 이후 `plan/complete/spec-update-masked-reject-framing.md`(planner 턴, `spec_impact` 에 해당 파일 명시 등재)로 사후 정규화됐다. 다만 **행위 자체**(권한 밖 파일을 잘못된 role 의 커밋에서 수정)는 절차 위반이며, "고칠 내용이 옳다는 것과 고칠 자격이 있다는 것은 다르다"고 작업자 스스로도 기록했다.
  - 제안: 이미 자체 발견·문서화·사후 planner 턴으로 정규화됐으므로 이번 라운드에서 추가 조치는 불필요. 향후 유사 fix 커밋에서 spec 변경이 필요하면 같은 턴에 planner 위임을 먼저 트리거하는 절차를 재확인할 것.

- **[INFO]** re-run 경로의 선존 버그(`errors`→`details` 봉투 배선) 수정이 "마스킹 마커 거부" 라는 요청 스코프를 넘어 기존 검증 에러 전반(missing_required/coerce_failed/invalid_schema)의 노출 방식도 함께 바꾼다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (catch 블록, `resolveTriggerParametersRejectingMasked` 바로 아래) — `errors: err.errors` → `details: toTriggerParameterErrorDetails(err.errors)`
  - 상세: 이 교정은 `masked_value_resubmitted` 만이 아니라 re-run 경로에서 발생 가능한 **모든** `TriggerParameterValidationError`(missing_required/coerce_failed/invalid_schema 포함)의 응답 노출 방식을 바꾼다 — 이전에는 `GlobalExceptionFilter` 가 `errors` 키를 읽지 않아 필드별 내역이 전부 조용히 버려졌는데, 이제 그 세 가지도 `details[]` 로 함께 노출된다. CHANGELOG·spec(`3-error-handling.md`, `1-manual-trigger.md` §6 각주)·RESOLUTION.md 세 곳에서 "새 코드만 얹으면 도달 못 하는 자리" 라는 근거로 명시적으로 정당화돼 있고 회귀 테스트(`executions-rerun.service.spec.ts` "[회귀] 거부 응답이 details[] 로...")로 고정돼 있어 은닉된 변경이 아니다 — 결합이 필연적이라는 설명도 타당하다(신규 에러 코드 하나만 추가하면 그 결과만 침묵 처리되는 불균형이 생긴다). 다만 "reject masked marker" 요청 범위를 문자 그대로 좁게 잡으면 이 부분은 부수적으로 넓어진 표면이라는 점은 기록해 둔다.
  - 제안: 조치 불요 — 이미 근거·테스트·문서로 명시적으로 커버됨. 참고 등재만.

- **[INFO]** `sanitize-error-message.ts` 의 `MASKED_MARKERS`/`isMaskedMarker` 를 module-private → `export` 로 승격
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`export const MASKED_MARKERS`, `export function isMaskedMarker`)
  - 상세: 새 판정 로직을 만들지 않고 기존 egress 마스킹 판정기를 그대로 재사용하기 위한 최소 변경이다(복제 시 미러 발산 위험을 명시적으로 근거로 듦). export 승격 외에 로직 변경은 없다.
  - 제안: 조치 불요 — 스코프 안의 정당한 최소 확장.

## 요약

핵심 스코프는 명확하다 — Manual 실행 경로(re-run `inputOverride`, execute `parameterValues`) 두 진입점에서 egress 마스킹 마커 재제출을 서버측 2차 방어층으로 거부하는 것이며, 실제 프로덕션 코드 변경 9개 파일이 전부 이 목적에 직접 기여한다(신규 헬퍼 1개, 타입/에러코드 매핑 1개 항목 추가, 호출부 2곳 교체, egress 판정기 재사용을 위한 export 승격, 테스트). 요청하지 않은 기능 확장·불필요한 리팩토링·무관한 파일 수정·포맷팅 잡음은 발견되지 않았고, `isPlainRecord` 중복 재구현 같은 전 라운드 지적은 `isRecord` import 로 이미 해소된 상태로 확인된다. 유일한 실질 스코프 이슈는 절차적인 것 — `fix(security)` 커밋 하나가 developer 턴에서 `spec/` 파일을 직접 건드려 CLAUDE.md 의 role 경계(개발자는 `spec/` read-only)를 위반했으나, 이는 작업자 스스로 실측(`git log -S`)으로 발견해 `plan/complete/spec-update-masked-reject-framing.md` 로 사후 정규화(planner 턴 + `spec_impact` 등재)까지 마친 상태다. 이 브랜치가 포함하는 대량의 `review/`·`plan/`·`spec/` 변경은 전부 동일 기능의 다라운드 리뷰-수정 루프와 그 spec 반영이며, 이 저장소 컨벤션(review/ 커밋 대상)과 부합해 스코프 이탈로 보지 않았다.

## 위험도

LOW
