# 변경 범위(Scope) 리뷰 — `impl-chat-channel-binder-t2` (3라운드, `19_06_54`)

## 검증 방법

`git log origin/main..HEAD --oneline` 로 4커밋 구성을 확인했다:

1. `a2e5b7e16` — T2 이동 자체(`setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` →
   `ChatChannelBinderService`/`trigger-callback-url.ts`)
2. `7e9aaa736` — plan 후속 등재(`--impl-prep` 발견 문서화)
3. `92f4b0607` — 1라운드 리뷰(`18_04_36`) W1·W2 수정
4. `8f43b1f56` — 2라운드 리뷰(`18_42_05`) W1·W2·INFO7·8 수정

`git diff origin/main --stat`(53개 파일)을 프롬프트 파일 목록과 전수 대조해 완전 일치를
확인했고, `.claude/**` 등 harness 경로 변경이 0건임을 `git diff origin/main --name-only`
전수 필터로 확인했다. 앞의 세 커밋(`a2e5b7e16`·`7e9aaa736`·`92f4b0607`)은 이미 커밋된
`review/code/2026/09/11/18_04_36/scope.md`(라인 단위 검증, NONE)와
`review/code/2026/09/11/18_42_05/scope.md`(`92f4b0607` 델타까지 커버, NONE)가 검증했으므로,
이번 라운드는 **그 뒤에 얹힌 4번째 커밋(`8f43b1f56`)** 을 `git show 8f43b1f56` 으로 직접
대조하는 데 집중하고, 앞 세 커밋의 결론이 여전히 성립하는지 재확인했다. 저장소에 어떤
뮤테이션도 가하지 않았다(읽기 전용 정적 대조만 수행, `git status --short` 로 세션 종료 시점
잔여 변경 없음을 확인).

## 항목별 점검 결과

### 1. 의도 이상의 변경

없음. 4개 커밋 각각이 자신의 커밋 메시지가 예고한 것과 정확히 일치하는 코드 변경만 낸다.
특히 4번째 커밋(`8f43b1f56`)은 직전 `/ai-review`(`18_42_05`) 가 낸 WARNING 3건(config 키를
무시하는 mock, 존재하지 않는 `@param` JSDoc 태그, 위치기반 boolean 테스트 헬퍼)만을 정확히
겨냥했다. 애플리케이션 코드 변경은 3개 파일뿐이고 각각 수 줄이다:
`chat-channel-binder.service.spec.ts`(+38/-8, `makeBinder` 를 named-args 로 + `afterEach`
로 `mockRestore` 위치 이동), `trigger-callback-url.ts`(+4/-4, `@param` 태그를 프로퍼티별
JSDoc 으로), `triggers.service.spec.ts`(+15/-2, `ConfigService` mock 을 키 인식형으로 +
`toHaveBeenCalledWith` 로 단언 강화).

### 2. 불필요한 리팩토링

없음. `makeBinder` 헬퍼 시그니처 변경은 프로덕션 코드(`buildTriggerCallbackUrl`)가 이미
채택한 "이름 인자로 순서 표면 제거" 원칙을 테스트 헬퍼에도 일관 적용한 것으로, 커밋 메시지가
그 근거(INFO7)를 명시하고 있다. 범위 밖 코드 정리는 없다.

### 3. 기능 확장

없음. 신규 분기·신규 필드·신규 엔드포인트 없음. 프로덕션 로직(`chat-channel-binder.service.ts`
본체, `triggers.service.ts`)은 이 4번째 커밋에서 전혀 건드리지 않았다 — 변경은 테스트와
JSDoc 뿐이다.

### 4. 무관한 수정

없음. 애플리케이션 코드 변경은 `codebase/backend/src/modules/triggers/` 3개 파일에 국한되고
`chat-channel/`·`secret-store/` 등 형제 모듈은 미변경이다. `.claude/**` 하위 harness 파일은
diff 에 전혀 없다 — plan 문서(`spec-draft-nullable-notation-followups.md`)에는 "reviewer
sub-agent 가 공유 워크트리를 뮤테이션한다"는 관측에 대한 처방을 **트래커에 적기만** 했고,
실제 `.claude/skills/code-review-agents/**` 코드는 이 PR 에서 고치지 않았다(본문이 스스로
"harness 축이고 이 PR 의 조치 대상 아님"이라고 명시). 문서화와 실제 하네스 수정이 섞이지
않았다는 점에서 스코프 경계가 정확하다.

### 5. 포맷팅 변경

없음. `git show 8f43b1f56` 각 diff 헝크는 실질 변경(named-args 전환, mock 키 인식화, 단언
강화)과 1:1로 대응한다. drive-by 재포맷 흔적 없음.

### 6. 주석 변경

diff 안에 포함된 JSDoc/주석 추가는 전부 그 줄의 코드 변경 사유를 설명하는 필요 주석이다
(`@param` 태그 제거·프로퍼티별 JSDoc 이동은 코드 구조 변경과 1:1, `makeBinder` 상단 설명
주석은 시그니처 변경 사유, `afterEach` 주석은 위치 이동 사유). 무관한 주석 첨삭 없음.

### 7. 임포트 변경

없음. 4번째 커밋에 import 추가/삭제가 없다.

### 8. 설정 변경

없음. `.env`/`tsconfig`/CI 워크플로/`package.json` 변경 없음.

## 전체 changeset(53파일) 재확인

앞선 두 scope 리뷰(`18_04_36`, `18_42_05`)가 이미 지적/확인한 대로, 이 changeset 은
"실질 코드 변경 대비 프로세스 산출물 비율이 매우 높다"는 특징을 유지한다 — 53개 파일 중
실제 애플리케이션 코드는 8개(그중 순수 이동/신규 파일 4개, 배선 변경 2개, 테스트 강화 2개)
뿐이고 나머지 45개는 `plan/in-progress/**`·`review/code/2026/09/11/{18_04_36,18_42_05}/**`·
`review/consistency/2026/09/11/17_39_32/**` 다. CLAUDE.md 의 정보 저장 위치 표가 코드
리뷰·일관성 검토 산출물의 정본 위치로 정확히 이 경로들을 지정하고 있고, 이 프로젝트의 표준
워크플로(구현 → `--impl-prep` → `/ai-review` 라운드 반복 → 발견 수정 → 커밋)가 그 산출물을
같은 작업 브랜치에 커밋하도록 강제하므로, 이 비율 자체는 스코프 이탈이 아니다. 다만 diff
크기만으로 "과도한 변경"이라 오판하기 쉬운 지점이므로, 앞선 라운드와 동일하게 기록해 둔다.

## 발견사항

- **[INFO]** changeset 53개 파일 중 45개가 plan/review 프로세스 산출물이고 실질 애플리케이션
  코드는 8개 파일뿐이다.
  - 위치: `git diff origin/main --stat` 전체 파일 목록.
  - 상세: 프로젝트 규약(`CLAUDE.md` "정보 저장 위치" 표: 코드 리뷰 산출물 →
    `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, 일관성 검토 산출물 →
    `review/consistency/...`)에 부합하는 정상 경로이며, 이전 두 scope 라운드(`18_04_36`,
    `18_42_05`)가 각각 동일한 관측을 이미 기록했다. 결함은 아니다.
  - 제안: 조치 불요 — 다음 리뷰어를 위한 참고 기록.

- **[INFO]** 4번째 커밋의 plan 문서 수정(`spec-draft-nullable-notation-followups.md`)이
  harness(reviewer sub-agent 워크트리 오염) 처방을 문서화하지만, 실제 harness 코드
  (`.claude/skills/code-review-agents/**`)는 이번 PR 에서 건드리지 않는다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — "병렬 리뷰어가
    저장소를 뮤테이션" 항목의 2026-09-11 재발(2회)·(3회) 주석.
  - 상세: 문서 자체가 "이건 harness 축이고 리뷰 게이트가 안 무니 검증은
    `python3 -m pytest .claude/tests -q`"라고 명시해, 이번 PR 의 조치 대상이 아님을 스스로
    밝히고 있다. 트래커 등재와 실제 수정을 섞지 않은 것은 스코프 경계를 정확히 지킨 사례다.
  - 제안: 조치 불요 — 긍정 관찰.

## 요약

4번째 커밋(`8f43b1f56`)은 직전 `/ai-review`(`18_42_05`)가 낸 WARNING 3건(설정 키를 무시하는
mock으로 인한 판별 불가, 구조분해 인자에 남은 존재하지 않는 `@param` 태그, 테스트 헬퍼의
위치기반 boolean)만을 정확히 겨냥한 최소 변경이며, 애플리케이션 코드 diff는 테스트 파일
2개와 JSDoc 주석 1곳(3~4줄)에 그친다. 프로덕션 로직·DI 배선·API 표면은 전혀 바뀌지 않았다.
앞선 세 커밋(T2 이동 자체 + 1·2라운드 리뷰 수정)은 이미 커밋된 두 scope 리뷰가 라인 단위로
NONE 판정했고, 이번 라운드의 재검토도 그 결론과 상충하지 않는다. changeset 전체(53파일) 중
plan/review 프로세스 산출물이 절대다수를 차지하는 특징은 이 프로젝트의 표준 리뷰 워크플로에
부합하는 정상 경로이며 스코프 이탈이 아니다. 범위를 벗어나는 리팩토링·기능 확장·무관한
수정·포맷팅 노이즈·불필요한 주석/임포트/설정 변경 중 어느 것도 발견되지 않았다.

## 위험도

NONE
