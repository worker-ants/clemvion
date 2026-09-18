# 변경 범위(Scope) 리뷰 — 웹훅 `endpoint_path` 전역 유일화 (V131/V132)

## 발견사항

- **[INFO]** 리뷰 diff 의 대부분(51개 파일 중 28개, 삽입 약 2,845줄 중 약 1,700줄)이 `review/consistency/2026/09/{18,19}/**` 4개 세션 산출물이다
  - 위치: `review/consistency/2026/09/18/23_39_46/**`, `review/consistency/2026/09/18/23_54_40/**`, `review/consistency/2026/09/19/00_07_54/**`, `review/consistency/2026/09/19/00_16_40/**`
  - 상세: 실제 코드 변경(마이그레이션 2개 + `triggers.service.ts`/`triggers.controller.ts`/테스트 2개)은 약 230줄로 작은데, 4회의 `consistency-check` 세션 원본이 통째로 커밋에 실려 diff 크기를 압도한다. 다만 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 를 직접 열어 대조한 결과, 이 4회는 정확히 CLAUDE.md 가 강제하는 게이트(`--spec` 1차·2차·3차 BLOCK:YES→YES→NO, `--impl-prep` 1회)와 1:1로 대응하고, `review/consistency/**` 는 프로젝트가 명시한 "정보 저장 위치(단일 진실 원칙)" 표의 정식 SoT 경로다. 우연한 포함이 아니라 워크플로가 요구하는 산출물이므로 스코프 위반으로 보지 않는다 — 다만 리뷰어·머지 담당이 diff 크기만으로 "범위가 크다"고 오판하지 않도록 기록해 둔다.
  - 제안: 없음(관례상 정상). 굳이 줄이려면 중간 라운드(1차·2차, BLOCK:YES 로 끝난 세션)는 `plan/complete/` 이관 시점에 archive 로 옮기는 것을 고려할 수 있으나 이는 이번 PR 의 책임 밖.

- **[INFO]** 에러 메시지에 원 지적(워크스페이스 문구 제거) 외 문장이 한 개 더 추가됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (rethrowEndpointPathConflict 내부, 함수명으로 특정 — diff 게이트가 컨텍스트만 표시하고 해당 줄 번호는 비어 있음)
  - 상세: 기존 `'같은 워크스페이스에 그 엔드포인트 경로를 쓰는 트리거가 이미 있어요.'` → `'그 엔드포인트 경로는 이미 다른 트리거가 쓰고 있어요. 새 경로를 쓰세요.'` 로 바뀌면서 "새 경로를 쓰세요" 라는 행동 유도 문구가 새로 붙었다. 워크스페이스 스코프 오류를 없애기 위한 최소 수정을 넘어서는 문구 추가이지만, 같은 줄을 이미 고치는 김에 붙인 한 문장 수준이라 실질적 영향은 미미하다.
  - 제안: 문제 삼을 정도는 아님. 엄격하게 가려면 스코프를 "워크스페이스 언급 제거"로만 좁혀 문구 추가는 별도 커밋으로 분리할 수도 있다.

## 검증한 항목 (문제 없음)

- `codebase/backend/src/modules/triggers/triggers.controller.ts`, `triggers.service.ts` 는 diff 전체를 `git diff origin/main`으로 직접 대조 — 프롬프트에 제시된 내용과 정확히 일치하며, 요청한 변경(인덱스명 상수 재배선·Swagger 설명·에러 메시지·관련 JSDoc) 외의 로직·포맷팅·임포트 변경 없음.
- `triggers.service.spec.ts`, `webhook-trigger.e2e-spec.ts` 는 fixture 인덱스명 치환 + 새 테스트(B5 교차 워크스페이스 e2e, B6 스키마 검증)만 추가 — 테스트 대상과 무관한 리팩토링 없음.
- `V131__trigger_endpoint_path_dedupe.sql`, `V132__trigger_endpoint_path_global_unique.sql`(+`.conf`) 는 신규 파일로 기존 마이그레이션을 건드리지 않음. README §5 "교체는 DROP-먼저" 절차·선례(V110)와 형태가 일치.
- `spec/1-data-model.md` 를 `git diff origin/main`으로 직접 열어 확인 — 필드 표·인덱스 표·신규 Rationale 절 모두 이번 결정(전역 UNIQUE)에 국한되고, 기존 절(FK 서른하나 처분 등)은 딱 한 문장만 forward-reference 로 보강했을 뿐 그 외 서술은 건드리지 않았다.
- `spec/2-navigation/2-trigger-list.md`, `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/7-channel-web-chat/5-admin-console.md`, `spec/data-flow/10-triggers.md` — 전부 "`(workspace_id, endpoint_path)`" → "`(endpoint_path)` 전역" 치환 또는 그에 직결된 한두 문장 보강뿐이며, `10-triggers.md` 는 반증된 옛 서술을 삭제하지 않고 취소선 + 정정 절로 남겨(CLAUDE.md 자기-반증형 소정정 스타일과 유사한 태도) 관련 없는 절은 그대로 뒀다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 원 트래커 항목을 "해소"로 체크하고, 파생으로 발견된 별개 결함(지운 경로 재등록·묘비 부재)을 새 항목으로만 등재했을 뿐, 이번 PR 에서 그 새 항목을 직접 구현하지 않음 — 스코프 확장 없이 올바르게 후속 트래킹만 함.
- 뮤테이션 없이 순수 조회(`git diff`, `Read`, `grep`)만 수행 — 저장소 상태 변경 없음. `git status --short` 로 원상태 확인.

## 요약

핵심 코드 변경(마이그레이션 2개, `triggers.service.ts`/`triggers.controller.ts`, 관련 테스트)은 "웹훅 `endpoint_path` 전역 유일화" 라는 단일 목적에 정확히 국한되어 있고, 드라이브바이 리팩토링·불필요한 포맷팅·무관한 임포트·설정 변경은 발견되지 않았다. spec 문서 7개와 plan 트래커 갱신도 이번 보안 결정이 반증한 문장들만 정확히 겨냥해 고쳤다. diff 의 절대 다수(28개 파일)를 차지하는 `review/consistency/**` 세션 산출물은 얼핏 스코프 과다로 보이지만, plan 문서와 대조한 결과 프로젝트가 강제하는 `--spec`/`--impl-prep` 게이트 4회분과 정확히 일치하는 정식 SoT 산출물이라 위반이 아니다. 발견된 두 건은 모두 INFO 수준(리뷰 규모 인지용 기록, 에러 메시지에 붙은 짧은 안내 문구)으로 실질적 스코프 이탈로 보기 어렵다.

## 위험도

NONE
