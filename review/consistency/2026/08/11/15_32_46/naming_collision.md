# 신규 식별자 충돌 검토 — `spec/7-channel-web-chat` (`safeApiBase`/`mergeBootConfig`/§R0)

## 점검 대상
- 신규: `safeApiBase`, `mergeBootConfig` (`codebase/channel-web-chat/src/widget/use-widget.ts`)
- 삭제: `safeApiBaseFromQuery`
- 신규 spec 앵커: `spec/7-channel-web-chat/4-security.md` `### R0. ...`

## 발견사항

Critical 없음. 아래는 확인 결과(대부분 "충돌 없음" 확인용 기록)와 INFO 1건.

- **[정보 확인] `safeApiBase` — 충돌 없음**
  - target 신규 식별자: `safeApiBase` (`codebase/channel-web-chat/src/widget/use-widget.ts`)
  - 기존 사용처: 없음. `git grep -n "safeApiBase\b"` 전체 저장소 결과, 이 식별자는 `use-widget.ts`/`use-widget.test.ts`/`spec/7-channel-web-chat/4-security.md` 세 곳(모두 target 변경의 일부)에만 존재.
  - 상세: 옛 이름 `safeApiBaseFromQuery` 를 대체하며 시그니처에 두 번째 인자 `source: "configFromQuery" | "wc:boot"` 를 추가(경고 문구용 입력 경로 태깅). 유사 이름으로 `codebase/channel-web-chat/src/app/demo/demo-config.ts` 의 `normalizeApiBase`, `codebase/frontend/src/lib/api/constants.ts` 의 `getServerApiBaseUrl` 이 있으나 둘 다 **선재(pre-existing)** 함수이고 정확히 다른 이름이며 서로 다른 관심사(경로 정규화 vs 서버 fetch base 조회)다. 특히 `session-store.ts:80` 에는 `demo-config.ts` 의 동명(`normalizeApiBase`) 함수와의 혼동을 경계하는 주석이 이미 있어, 이 계열의 이름 혼동은 저장소가 인지하고 있는 기존 사안이며 이번 diff 가 새로 만든 충돌이 아니다.
  - 제안: 없음(조치 불요).

- **[정보 확인] `mergeBootConfig` — 충돌 없음**
  - target 신규 식별자: `mergeBootConfig` (`codebase/channel-web-chat/src/widget/use-widget.ts`)
  - 기존 사용처: 없음. `git grep -n "mergeBootConfig"` 결과, `use-widget.ts`/`use-widget.test.ts`/`use-widget-eager-start.test.ts`(주석)/`4-security.md` 뿐. `codebase/backend/src/nodes/logic/merge/*` 의 `MergeConfig`(워크플로우 merge 노드 설정 인터페이스, PascalCase 타입)와는 이름이 정확히 다르고(대소문자·`Boot` 유무) 도메인도 완전히 분리(워크플로우 노드 설정 vs 웹챗 위젯 boot 병합)돼 실사용 혼동 가능성이 낮다.
  - 제안: 없음(조치 불요). 다만 완전히 동일한 명명 패턴(`merge*Config`)이 backend/frontend 에도 존재한다는 점은 참고 정보로만 남긴다.

- **[정보 확인] `safeApiBaseFromQuery` 삭제 후 잔존 참조 — 0건**
  - 확인 범위: `codebase/**`, `spec/**`, `plan/in-progress/**` (요구된 전 범위) — `git grep -n "safeApiBaseFromQuery"` 결과 0건.
  - 예외 범위(허용됨, 실제로 존재): `plan/complete/webchat-boot-apibase-scheme-validation.md`(본 변경을 완료 처리한 바로 그 plan — 옛 이름을 "이전 상태"로 서술), `plan/complete/webchat-polish-batch.md`(과거 완료 이력), `review/code/2026/06/28/14_49_11/*.md`(그 시점 코드 리뷰 기록). 프롬프트가 명시한 "완료 plan·review 시점 기록은 예외" 에 정확히 해당하므로 문제 없음.
  - 상세: `plan/complete/webchat-boot-apibase-scheme-validation.md` 는 이번 브랜치에서 새로 `plan/complete/` 로 추가된 파일이며(커밋 `3f1169ab5`, `d8abc7003`) `safeApiBase`/`§R0` 를 이미 신규 이름으로 정확히 서술하고 있어 target 코드·spec 변경과 정합한다.
  - 제안: 없음.

- **[정보 확인] `4-security.md` §R0 앵커 — 기존 R-번호 앵커를 깨지 않음**
  - target 신규 식별자: `### R0. apiBase 스킴 검증을 두 경로 모두에 거는 이유 (2026-08-11)`
  - 기존 사용처: `spec/5-system/1-auth.md:713`, `spec/5-system/12-webhook.md:69,338,392`, `spec/data-flow/10-triggers.md:101` 가 모두 `4-security.md#r6-공개-webhook-ip-미식별--단일-공유-버킷-완화-한도` 를 인용(§R6 대상).
  - 상세: R0 은 기존 R1~R6 **앞**에 새 섹션으로 삽입됐을 뿐 기존 R1~R6 을 리넘버링하지 않았다(문서 내 `### R1.`~`### R6.` 헤딩 텍스트 불변 확인). GitHub 스타일 앵커는 헤딩 텍스트 슬러그이므로 `#r6-...` 앵커 문자열도 그대로 유지된다. 저장소 전체에서 `§R0`/`### R0.` 를 이 문서 이전에 사용한 곳은 없어(신규 부여) ID 충돌도 없다.
  - 제안: 없음. (참고: 만약 이후 §R0 를 다른 섹션으로 다시 쓰거나 R 번호를 재활용하면 위 4개 문서의 `#r6-...` 링크에는 영향 없으나, R0 자체를 인용하는 문서가 생기면 그때 재확인 필요.)

## 요약
target 이 도입하는 두 식별자(`safeApiBase`, `mergeBootConfig`)는 저장소 전체에서 이번 변경분 외에는 등장하지 않아 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일경로 어느 축에서도 실질 충돌이 없다. 삭제된 `safeApiBaseFromQuery` 는 `codebase/`·`spec/`·`plan/in-progress/` 전 범위에서 잔존 참조 0건이며, 남은 참조는 모두 규약이 정한 예외(`plan/complete/`, `review/`)에 속한다. 신규 `§R0` 앵커도 기존 R1~R6 섹션의 앵커 문자열을 리넘버링 없이 보존해 4개 타 spec 문서의 `#r6-...` 역참조를 깨지 않는다. 발견된 유사 이름(`normalizeApiBase`, `MergeConfig`)은 모두 선재하며 정확히 다른 이름·다른 도메인이라 이번 변경이 만든 신규 충돌이 아니다.

## 위험도
NONE

STATUS: OK
