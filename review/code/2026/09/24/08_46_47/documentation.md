# 문서화(Documentation) 리뷰 — member-owner-toctou (2라운드, `08_46_47`)

## 배경 확인

이 diff 는 이전 라운드(`review/code/2026/09/24/08_09_57`)의 documentation 리뷰가 지적한
**WARNING 1(`CHANGELOG.md` 누락)** 에 대한 조치를 포함한 fresh 라운드다. 실제로 조치됐는지,
그리고 그 조치 및 이번 라운드에서 추가된 나머지 변경(`workspaces.service.ts`/`.spec.ts`,
`member-remove-concurrency.e2e-spec.ts`, `test/helpers/concurrency.ts`,
`integration-rotate-concurrency.e2e-spec.ts`, plan 문서 2건)을 문서화 관점에서 재검토했다.

## 발견사항

없음 — Critical·Warning 없음.

### 확인한 양호 사항

- **CHANGELOG 누락(이전 라운드 WARNING 1)이 정확히 해소됐다.**
  - 위치: `CHANGELOG.md:3-35` (신규 항목), `CHANGELOG.md:217-227` (`#1373` 항목 정정)
  - `CHANGELOG.md` 최상단에 이번 수정을 설명하는 새 `## Unreleased` 항목을 추가했다 — 결함
    서술, 판별 실측(고치기 전 200 / 고친 뒤 403), 고친 것 3가지, 남는 것(권한 검사 순서
    오라클 블라스트 반경 정정)까지 형제 항목들과 동일한 구조를 지킨다.
  - `#1373` 항목의 기존 "남는 것" 문장 중 `owner 승격 TOCTOU(실측 재현)` 부분을 취소선으로
    남기고 `> owner 승격 TOCTOU 는 2026-09-24 해소됐다 — 맨 위 항목이 그것이다.` 라는 정정
    각주를 추가했다 — 이 저장소가 반복해서 지켜온 "전방 참조는 취소선 + 해소 각주로 정정한다"
    관례(예: `model_config`/`auth_config` 항목의 기존 취소선 패턴, `CHANGELOG.md:124-128`,
    `:167-173`)와 정확히 일치한다.
  - CHANGELOG 자체가 "같은 함수에서 재발한 누락" 을 설명하는 `#1373 backfill` 항목
    (`CHANGELOG.md:181-227`)을 이미 담고 있는 상황이라 재발 리스크가 특히 높았는데, 이번엔
    사전에 잡혔다.

- **코드 주석·JSDoc 이 실제 구현과 정확히 일치한다** (`workspaces.service.ts`).
  - `throwCannotRemoveOwner()`(`:349-360`)의 JSDoc 은 "두 자리가 쓴다" 고 말하며, 실제로
    이른 가드(`:826`)와 0-행 재조회 backstop(`:871`) 두 호출부가 있다 — 서술과 코드가
    일치한다. 바로 위 `throwMemberNotFound()` 세 벌 복제 선례를 인용한 근거 제시도 확인됨.
  - `removeMember()` JSDoc(`:802-809`)이 "동시성 보장" 문단을 감사 중복 방지 + owner 삭제
    방지 **둘**로 정확히 갱신했다 — 이 PR 이전 예고("owner 가드까지 원자화하지 않는다")를
    반증했으므로 정정이 필요했던 자리이고, 실제로 고쳐졌다(plan `§D` 가 스스로 예고).
  - DELETE 문 위 인라인 주석(`:840-853`)이 서술하는 Postgres READ COMMITTED EvalPlanQual
    메커니즘·`4-execution-engine.md §8` 과의 차이 설명을 실제 spec 문서로 대조 확인했다 —
    `spec/5-system/4-execution-engine.md:1153` "## 8. 동시 실행 제한" 이 실재하고, 그 절이
    말하는 "타-행 집계 조건"(동시 실행 수)과 이번 자리의 "같은-행 조건" 구분이 정확하다.
  - `spec/data-flow/12-workspace.md:141`(멤버 제거 행)이 "owner 는 제거 불가" 만 적고
    메커니즘을 규정하지 않는 반면, `:188`(`deleteWorkspace`)·`:189`(`leaveWorkspace`) 행은
    비관적 락을 명시한다는 plan 의 주장도 직접 대조해 정확함을 확인했다.
  - `still` 재조회 관련 주석(`:866-870`)이 "재조회는 존재 여부만 본다" 고 서술하고 실제
    코드(`if (still) this.throwCannotRemoveOwner();`)와 정확히 일치한다 — 이전 라운드
    WARNING 3(제3 상태 미처리) 지적이 반영된 결과다.

- **테스트 JSDoc 도 구현과 일치한다** (`workspaces.service.spec.ts`).
  - `wireFindOne` 의 신규 `targetOnReread` 파라미터 JSDoc(`:1475-1479`)이 "두 번째 조회부터
    이 값을 답한다", "생략하면 항상 target" 이라 서술하며, 실제 구현
    (`first || targetOnReread === undefined ? target : targetOnReread`)과 정확히 일치한다.
  - `FindOperator` 를 직접 언박싱하는 단언(`:1509-1515`) 위 주석이 `toHaveBeenCalledWith`
    의 deep-equality 한계와 e2e 오라클 위임을 정확히 설명한다 — 형제 파일
    `sessions.service.spec.ts` 인용도 실재한다(과거 라운드에서 이미 확인된 선례).
  - 새 `it` 3종(owner 승격 403 / 강등 후에도 403 / 행 소실 404) 각각의 JSDoc 이 "무엇을
    죽이는 뮤턴트인지" 를 명시하고, `plan/in-progress/member-owner-toctou.md` §E 뮤턴트
    표(A/B′/B″/C)와 1:1 대응한다.

- **e2e 신규 블록의 독스트링**(`member-remove-concurrency.e2e-spec.ts:183-208`)이 판별력
  (고치기 전 200)·재진입 설계 이유·`raceUnderHeldLock` 을 쓰지 않는 이유·전용 워크스페이스를
  쓰는 이유까지 서술하며, 실제 코드가 그대로 이행한다 — `createTeamWorkspace` 로 격리된
  워크스페이스를 생성해(`:210-214`) 이전 라운드 WARNING 4(공유 워크스페이스 오염)를
  구조적으로 없앴다(주석 의존 불변식 제거).

- **`VACUITY_GUARD_MS` export 이유가 JSDoc 에 명시**(`test/helpers/concurrency.ts:25-29`)돼
  있고, 실제로 두 e2e 파일(`integration-rotate-concurrency.e2e-spec.ts:9`,
  `member-remove-concurrency.e2e-spec.ts:11`)이 import 해 리터럴 하드코딩을 없앴다 — 이전
  라운드 WARNING 5 조치가 정확하다.

- **plan 문서 2건**(`member-owner-toctou.md` 신규, `spec-draft-nullable-notation-followups.md`
  추가분)이 기각한 대안의 근거를 실측(단위 테스트 도달 가능 케이스 수)으로 남기고, 뮤턴트
  예측/실측 표를 갖췄으며, 트래커에 등재한 후속 항목마다 "왜 이번 PR 스코프가 아닌지" 를
  명시한다 — CLAUDE.md `spec_impact` 규약(리스트 또는 `none`)도 `spec_impact: none` 로
  올바르게 기재돼 있고 그 판단 근거(§C)가 함께 있다.

- **README/설정 문서**: 신규 환경변수·설정 옵션·엔드포인트 없음 — README 갱신 대상 아님(이전
  라운드 확인 재검증: `codebase/backend/README.md` 에 관련 참조 없음, 변경 후에도 없음).

- **API 문서**: 응답 코드·상태 코드·엔드포인트 시그니처 변경 없음(발생 조건만 좁아짐) — API
  문서 갱신 불요. `CANNOT_REMOVE_OWNER` 가 중앙 에러 카탈로그(`3-error-handling.md` §1)에
  미등재인 기존 갭은 이미 planner 트래커 항목으로 등재돼 있어(같은 `--impl-prep` WARNING)
  중복 지적하지 않는다.

- `review/code/2026/09/24/08_09_57/**`, `review/consistency/2026/09/24/07_29_15/**` 신규
  파일들은 이전 라운드/사전 게이트의 산출물을 CLAUDE.md 저장 위치 규약(`review/code/**`,
  `review/consistency/**`)대로 커밋한 것이며, 히스토리 스냅샷이므로 그 내용을 지금 시점
  기준으로 다시 교정할 대상이 아니다.

## 요약

이전 라운드에서 유일하게 지적된 문서화 WARNING(`CHANGELOG.md` 누락, 같은 함수 `removeMember`
에서 재발 위험이 특히 높았던 사안)이 이번 라운드에서 정확하고 관례에 맞게 해소됐다 — 신규
CHANGELOG 항목·전방 참조 취소선 정정·해소 각주 3박자를 모두 갖췄다. 코드/테스트의 JSDoc·
인라인 주석은 실제 구현과 대조 검증한 결과 전부 정확했고, `4-execution-engine.md §8`·
`data-flow/12-workspace.md` 인용도 실재 문서와 일치한다. README·API 문서·설정 문서 갱신
대상이 되는 변경은 없다. 문서화 관점에서 이번 라운드는 병합을 막을 사유가 없다.

## 위험도

NONE
