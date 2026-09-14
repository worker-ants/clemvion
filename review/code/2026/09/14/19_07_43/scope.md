# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff origin/main..HEAD`(커밋 `567c82edb`, `12ed21ff1`)로 실제 diff 를 직접 열어
프롬프트의 각 파일과 대조했다. 프롬프트에서 생략된 파일(6·12·13)과 잘린 파일(7)은
`git diff` 로 전문을 확인했다. 저장소에 뮤테이션을 가하지 않았다 — 아래 "참고" 절의
관측 확인(`git show HEAD:<path>` 를 임시 파일로 diff)만 했고 저장소 파일을 직접
쓰거나 되돌리지 않았다.

## 발견사항

없음. 아래는 판단 근거다.

### 핵심 변경 — 단일 결함에 정확히 대응

두 커밋(`567c82edb`, `12ed21ff1`)이 만지는 코드 파일은 모두 "동시 PATCH 가
`trigger.config` 를 되돌려 `inboundSigningRef` 가 사라지고 인입 서명 검증이
fail-open 이 되는" 단일 결함 — 그리고 그 결함의 네 번째 창(§D, `TriggersService.update()`
의 `save`)으로 정확히 수렴한다.

- `trigger-config-lock.ts`(신규) + `.spec.ts`(신규): 결함을 닫는 공용 유틸과 그 계약만의
  전용 테스트. 헬퍼 계약 자체(락 순서·행 소실·스프레드 순서)를 보는 것으로, 서비스 경유
  테스트와 역할이 겹치지 않는다.
- `chat-channel-binder.service.ts`: 기존 두 자리(성공/실패 경로)의 거의 동일한 인라인
  머지 로직을 `buildChannel` 클로저 하나로 추출했다. 이 추출은 무관한 정리가 아니라 —
  이번 PR 자체가 "두 자리 중 한쪽만 고치는" drift 를 겪은 뒤(리뷰 `18_17_44`
  maintainability WARNING#6) 그 재발을 막으려 도입한 것으로, plan 문서(§D)에 근거가
  명시돼 있다.
- `triggers.service.ts`: `update()`(창 1)와 `rotateBotToken()`(창 4)의 두 쓰기 지점만
  advisory lock + 재읽기로 바꿨다. `save(trigger)` 라는 저장 동사는 명시적으로 보존했다 —
  `update`+재조회로 바꿨다가 단위 6건이 깨져 되돌린 이력이 plan 에 기록돼 있다(불필요한
  리팩토링을 피하려는 흔적).
- `endpoint-path-conflict-wrap-guard.ts` / `.spec.ts` / `endpoint-path-save.fixture.ts`:
  본 PR 자체가 `save()` 호출을 `manager.transaction(...)` 콜백 안으로 옮기며 기존
  정적 가드(수신자 이름 기반)를 무력화했다. 이 세 파일의 변경은 "관련 없는 코드 정리"가
  아니라 자신이 만든 리팩토링이 깬 회귀 가드를 원상 복구하는 것이며, plan §D("창 1 을
  옮기자 정적 가드가 눈이 멀었다")에 원인과 대응이 명시돼 있다. 인식 축을 넓히면서
  음성 대조군(`managerSaveOtherEntity`)도 함께 넣어 술어가 필요 이상으로 넓어지는 것을
  스스로 견제했다.
- `__test-utils__/trigger-transaction-mock.ts`(신규): `TriggersService.update()` 가
  트랜잭션을 쓰게 되면서 `getRepositoryToken(Trigger)` mock 을 가진 6개 spec 파일이 함께
  깨진다. 공용 헬퍼로 올린 것은 기능 확장이 아니라 이번 리팩토링이 요구하는 최소 배선이다.
  이번 diff 에서 실제로 소비하는 파일은 `triggers.service.spec.ts` 와
  `triggers.web-chat.spec.ts` 두 곳뿐이고, 나머지 4개 파일은 이번 PR 범위 밖으로 남아있다
  (plan 에 "후속" 으로 명시).
- `test/trigger-config-lost-update.e2e-spec.ts`(신규): 이 결함 전용의 새 e2e 파일. 기존
  e2e 파일을 확장하지 않고 별도 파일로 분리해 무관한 suite 를 건드리지 않았다.
- `CHANGELOG.md`: 이번 behavior change 하나만 기술.

### 의도적으로 범위를 넓히지 않은 흔적

`plan/in-progress/trigger-config-lost-update.md` §A 는 같은 "in-memory 스냅샷으로
`config` 를 통째로 덮는" 패턴이 `src/` 전수에 19건(신규 헬퍼 제외) 있음을 실측하고도,
이번 PR 은 그중 결함이 실제로 재현되는 4개 창(§A 표)만 고쳤다. 나머지(`config` 를 암묵적으로
싣는 `save()` 10곳 중 미확정 6곳, `remove()` 의 좁은 삭제 레이스, 상태 컬럼의 락 밖 갱신,
헬퍼의 `Trigger` 하드코딩 등)는 "이 PR 로 넓히지 않는다"로 명시 보류하고 후속 항목으로
등재했다. spec 편집이 필요한 항목(`redis-keys.md §4` 등재, `chat-channel-*.md` glob 갱신,
회전 정책 자기모순)도 developer 권한 밖이라 planner 범위로 넘겼다 — 이는 CLAUDE.md 의
역할 경계를 준수한 것이지 위반이 아니다. 이런 명시적 "하지 않는 것" 섹션은 스코프 관리가
사후적이 아니라 설계 단계에서 의도적으로 이뤄졌음을 보여준다.

### plan / review 산출물 커밋 — 이 저장소의 표준 관행

`plan/in-progress/trigger-config-lost-update.md`, `review/code/2026/09/14/18_17_44/**`,
`review/consistency/2026/09/14/17_10_16/**` 가 코드 커밋과 함께 포함돼 있다. 이는
무관한 파일 혼입이 아니라 이 저장소의 확립된 관행이다 — 직전 커밋들(`fdf576a2f`,
`30301008c`)도 동일하게 `plan/**` + `review/code/**` + `review/consistency/**` 산출물을
코드 변경과 같은 커밋에 포함시켰음을 `git show --stat` 으로 확인했다. `review/` 는
gitignore 대상이 아니며 SoT 참조용으로 보존하는 것이 규약이다.

### 포맷팅 / 주석 / 임포트

`--ignore-all-space` 로 대조해도 diff 라인 수가 그대로였다(`chat-channel-binder.service.ts`
101줄 동일) — 공백만 바뀐 줄이 실질 변경과 섞여 있지 않다. 새 임포트(`rewriteTriggerConfigLocked`,
`triggerConfigLockKey`, `withTransactionMock`)는 전부 해당 파일에서 실제로 쓰인다. 추가된
주석·JSDoc 은 분량이 크지만 전부 이번 결함의 설계 근거·기각된 대안·실측 결과를 기록하는
것으로, 이 저장소의 다른 커밋들과 같은 문서화 밀도이며 무관한 주석 수정은 없었다.

## 참고 (절차 투명성 — 이 PR 자체의 스코프 결함은 아님)

리뷰 도중 `git status --short` 가 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
를 **modified** 로 보고한 순간이 있었다. `git diff origin/main` 대비로는 0줄(=이 파일이
`origin/main` 상태, 즉 이 PR 의 두 커밋이 만든 변경 전부가 사라진 상태)이었고,
`git diff HEAD`/`git diff 567c82edb` 로는 각각 134·119줄이 차이 났다 — 즉 누군가(다른
병렬 리뷰어로 추정) 이 파일을 **커밋 이전(pre-fix) 상태로 되돌려** 놓은 순간이 관측됐다.
곧이어 재확인하니(`git show HEAD:<path>` 를 `/tmp` 로 떠서 diff) 파일은 HEAD 와 정확히
일치하는 정상 상태로 복원돼 있었고 `git status --short` 도 다시 clean 했다. 프롬프트
규약이 경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate" 정황과 일치하며, 직전
리뷰 라운드(`review/code/2026/09/14/18_17_44/api_contract.md`)의 "참고" 절이 기록한 것과
같은 종류의 사건이다. 이 리뷰를 작성하는 시점 기준으로 저장소에 잔여 이상 상태는 없다
(`git status --short` 는 이 리뷰 산출물 디렉터리 외 깨끗함). 스코프 판정에는 영향을
주지 않지만, 다음 라운드 리뷰어가 같은 현상을 다시 볼 수 있어 기록만 남긴다 — 이번엔
직접 mutate 하거나 `git checkout`/`restore` 로 손대지 않았다.

## 요약

두 커밋 모두 "동시 PATCH 가 `trigger.config` lost-update 를 일으켜 인입 서명 검증이
fail-open 되는" 단일 결함으로 수렴하며, 코드 변경 12개 파일이 그 결함의 핵심 수정·직접
파생 수정(정적 가드 복구, 공용 테스트 mock)·전용 테스트로만 구성돼 있다. 넓은 범위의
동일 패턴(19건)을 실측하고도 재현 가능한 4개 창만 고치고 나머지는 plan 문서에 후속/planner
항목으로 명시 보류한 점, `save()` 저장 동사를 불필요하게 바꾸지 않은 점, 정적 가드 수정
범위를 `Trigger` 엔티티로만 좁힌 점 등에서 스코프 관리가 의도적이고 절제돼 있다.
plan·review 산출물 동반 커밋은 이 저장소의 확립된 관행과 일치한다. 스코프 관점에서
지적할 사항이 없다. 리뷰 중 다른 병렬 세션으로 추정되는 일시적 파일 되돌림이 관측됐으나
(위 "참고" 절) 확인 시점에는 이미 정상 복원돼 있었고 이 PR 자체의 스코프 결함이 아니다.

## 위험도

NONE
