STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트가 제공한 diff(다수 파일은 크기 제한으로 생략)를 기반으로, 핵심 구현·테스트·spec 파일은
`Read`/`Grep` 으로 직접 열어 line-level 로 대조했다: `codebase/frontend/src/lib/utils/masked-markers.ts`
(+test), `codebase/frontend/src/components/executions/rerun-modal.tsx` (+test 990줄 전수 `it(` 목록),
`codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (+test `it(` 목록),
`codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution`/`toResponseExecution`/re-run
입력 분기)+`.spec.ts`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts`,
`spec/5-system/14-external-interaction-api.md` §R17 전문, `plan/in-progress/eia-inputdata-marker-guard.md`,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `CHANGELOG.md` 전문. 이 changeset 은 이미
같은 작업(`review/code/2026/08/20/{14_08_45,14_44_08,15_10_25,15_32_34,15_59_17,16_25_35}/`)에 걸쳐 8라운드
`/ai-review` + 9라운드 `/consistency-check` 를 거쳐 CRITICAL 0 으로 수렴한 상태이며, 이번은 그 최종
changeset(`origin/main..HEAD`)에 대한 독립 재검증이다.

## 발견사항

없음 — CRITICAL/WARNING 급 발견 없음.

독립 검증으로 확인한 것들 (참고, 조치 불요):

- **비즈니스 로직 정합**: Re-run 모달의 `blockedByMaskedInput` 3조건 합(터치·마커 잔존·구조필드
  파싱실패)이 spec(`14-external-interaction-api.md` §R17 표, 2026-08-20 반영분)의 서술과 정확히
  일치한다. 각 조건이 왜 필요한지(단독으로 뚫리는 경로)를 코드 주석 표와 spec 표가 같은 내용으로
  중복 기술하고 있고, 실제로 diff 히스토리(`RESOLUTION.md` 3건)가 그 세 라운드의 반증 과정을 보여준다.
  `rerun-modal.test.tsx` 는 이 3조건 각각의 캐너리(터치만/값만/구조필드 무효 JSON)를 개별 `it` 로
  고정해 뒀다.
- **깊이 상한 매핑**: `hasMaskedMarkerLeaf` 의 `MAX_MARKER_SCAN_DEPTH = 10` 이 backend
  `sanitize-error-message.ts` 의 `MAX_REDACT_DEPTH = 10` 과 실제로 일치함을 grep 으로 확인. 값 검사가
  깊이 검사보다 먼저 실행되는 순서(off-by-one 이 fail-open 이 되는 지점)도 코드·테스트가 정확히
  일치.
- **에러 시나리오**: `editor-toolbar.tsx` 의 `jsonError` — JSON.parse 실패 시 마커 검사를 건너뛰고
  파싱 에러만 보여준다(catch 블록에서 return), 파싱 성공 시에만 `hasMaskedMarkerLeaf` 검사. 두
  실패 모드가 뒤섞이지 않고 명확히 분리돼 있다.
- **anchor 정리**: `MASKED_INPUT_DATA_REASON` 문자열이 `codebase/`·`spec/` 전체에서 0건(grep 확인) —
  CHANGELOG 의 "앵커 전수 삭제" 주장이 실측과 일치한다.
- **자매 표면 누락 재발 없음**: `background-runs.service.spec.ts` 는 `outputData`/`inputData` 를
  **개별 assertion** 으로 분리해 두었고(과거 라운드에서 합쳐진 `toContain` 이 한쪽 누락을 못 잡는
  결함이 지적된 뒤 수정됨), `[REDACTED]` ingestion 마커 보존 캐너리도 이 표면에 새로 추가돼 있다 —
  이 PR 자체가 한 번 겪은 "자매 중 하나만 갱신" 결함 클래스가 재발하지 않았음을 테스트로 고정.
- **문서 재발 패턴 해소**: `documentation.md`(`14_44_08`)가 지적한 `executions.service.spec.ts` 의
  구 결론 소제목(`inputData` 는 **의도적으로 대상이 아니다**)은 이후 라운드(`15_10_25`)에서
  `## 두 레벨 모두 마스킹 대상이다` 로 재작성됐음을 grep 으로 확인 — 이 저장소가 반복 겪은
  "본문만 고치고 헤딩은 방치" 패턴이 이번엔 최종적으로 해소됐다.
- **CHANGELOG 자기모순 해소**: 최상단 신규 항목과 하단의 기존 `#1180` 항목(`"Execution.inputData` 만
  마스킹하지 않는다 (의도)"`)이 정반대 결론인데, 하단 항목에 "이 카브아웃은 2026-08-20 에 닫혔다"
  로 되돌아가는 blockquote 가 달려 있어 두 항목을 순서대로 읽어도 모순으로 안 읽힌다.
- **트래커로 정확히 유예된 항목**: `inputOverride` 서버측 마커 리터럴 거부(`curl` 직접 호출 우회)는
  CHANGELOG 가 스스로 "UI 정상 흐름 한정"이라 명시하고 트래커(`spec-sync-external-interaction-api-gaps.md`
  line 322)에 등재돼 있다. 이 항목 자체는 이 PR 이전부터 존재하던 gap(서버는 원래도 타입·필수값만
  검증)이고, security reviewer 가 라운드마다 독립적으로 "기밀성 침해 아님 + 피해는 호출자 자신"으로
  INFO 판정한 근거도 코드 확인(re-run 흐름이 `resolveTriggerParameters` 로 타입만 검증)과 일치한다.
  다만 CHANGELOG 의 "§R17 이 가드 범위를 UI 정상 흐름으로 명시했다"는 과거 유예 근거가 스스로
  과장이었다고 인정(트래커 line 330-335, `17_38_33` 실측)하고 착수 시 planner 턴을 병행하기로
  트래커에 명문화해 뒀다 — spec 자체에 아직 그 범위 문장이 없다는 사실과 CHANGELOG 서술("착수 시
  … 함께 한다")이 모순되지 않는다(미래형으로 정확히 서술됨).

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정이 backend 두 관문(`toResponseExecution`/
`toExecutionDto`)·frontend 세 소비처(폼 프리필/Re-run 모달/에디터 히스토리 로드)·DTO Swagger 설명·
spec 7개 문서·유저 가이드 4개(ko/en)에 걸쳐 정확히 반영돼 있다. 핵심 비즈니스 로직(Re-run 모달의
3조건 차단 판정)은 세 라운드의 반증을 거쳐 각 조건이 막는 구체적 우회 경로가 코드 주석·spec 표·테스트
캐너리 세 곳에서 동일하게 기술되고 실제로 방어된다. 독립적으로 재검증한 결과 기능 완전성·엣지
케이스(깊이 상한·object/array leaf·orphan 스키마 키·재조정 타이밍)·에러 시나리오·spec fidelity 어느
관점에서도 CRITICAL/WARNING 급 결함을 찾지 못했다. TODO/FIXME/HACK 류 미완성 표식도 diff 범위 내
신규 코드에는 없다. 남은 항목(서버측 마커 거부, 게이트 4곳 통합 헬퍼, 마커 미러 계약 테스트, 응답
의미 반전의 외부 소비자 확인)은 모두 이번 PR 범위 밖 사안으로 성격이 명확히 갈려 트래커에 등재돼
있고, 이번 PR 이 만든 결함이 아니라는 근거(security reviewer 독립 INFO 판정, "이번 PR 이전부터
존재")도 코드로 확인된다.

## 위험도

NONE
