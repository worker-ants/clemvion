# 변경 범위(Scope) 리뷰 — webchat-boot-single-flight (00_51_53)

## 페이로드 청결 직접 확인

```
git merge-base origin/main HEAD  → 29aa918a653a0efb5f792dc7e105c0887f03ef25
git diff --name-only $(git merge-base origin/main HEAD)..HEAD | wc -l → 41
git diff --name-only origin/main..HEAD | wc -l                        → 41
diff <두 목록>                                                          → 동일(0 라인 차이)
```

**merge-base == origin/main == `29aa918a6`** 이고 두 목록(3-dot 기준/2-dot 기준)이 파일명·개수(41) 모두
바이트 동일하다. 이번 라운드는 main 이 전진하지 않은 상태라 2-dot/3-dot 드리프트가 원리적으로 없다 —
페이로드 오염 없음.

## 이번 라운드 초점 — 23_58_23 리뷰 이후 델타

`git log --oneline origin/main..HEAD` 로 확인한 23_58_23 리뷰(RESOLUTION 존재 확인) 이후 커밋은 정확히
5개, 지시된 4개 범주와 1:1 대응한다:

| 커밋 | 분류 | 터치한 파일 |
| --- | --- | --- |
| `7cfbf2557` | start() fix (CRITICAL 대응) | `use-widget.ts`, `use-widget-eager-start.test.ts`(신규 테스트) |
| `a2cd6ebb7` | WARNING 정합 | `use-widget-eager-start.test.ts`, `use-widget.ts`(1줄), `webchat-boot-single-flight.md`, `webchat-usewidget-extraction.md`(신규) |
| `213561c3f` | 재현 테스트 lint 수정 | `use-widget-eager-start.test.ts` |
| `e62530291` | review 산출물(23_58_23 SUMMARY+RESOLUTION 최초 커밋) | `review/code/2026/07/17/23_58_23/*` 12파일(전부 신규) |
| `5eed8cf96` | review 산출물(검증 근거 갱신) | `review/code/2026/07/17/23_58_23/RESOLUTION.md` |

`git diff --name-only 3f55ee000..HEAD`(23_58_23 리뷰 시점 HEAD 부터)로 직접 재계산한 결과도 **정확히
위 16개 파일**(코드 2 + 테스트 1(파일은 코드와 겹침, 실제 고유 파일은 4개: `use-widget.ts`,
`use-widget-eager-start.test.ts`, `webchat-boot-single-flight.md`, `webchat-usewidget-extraction.md`) +
review 산출물 12개)과 정확히 일치한다. 그 외 파일(백엔드·프론트엔드·`widget-state.ts`·spec 등)은 이번
델타에서 0줄 — 지시된 범위 밖 파일 접촉 없음.

## 발견사항

### start() fix (`7cfbf2557`) — 최소성 검증: **확인됨**

`use-widget.ts` 프로덕션 코드 변경은 정확히 다음 하나뿐이다(`git show 7cfbf2557` 직접 대조):

```diff
+    const bootAtStart = bootGenRef.current;
     dispatch({ type: "START" });
     ...
-        const outcome = await seedWaitingFromStatus(client, session);
+        const outcome = await seedWaitingFromStatus(client, session, { boot: bootAtStart });
```

- **스냅샷 캡처 1줄** (`const bootAtStart = bootGenRef.current;`) — 정확히 1줄, 부수효과 없음(단순 읽기).
- **인자 1개 추가** (`{ boot: bootAtStart }`) — `seedWaitingFromStatus` **함수 자체는 이 커밋에서 전혀
  수정되지 않았다.** `attempt?: { boot: number }` 파라미터와 `if (attempt && cannotApplyConfig(attempt))
  return "stale";` 가드는 이미 이전 라운드(`applyConfig` 호출부용)에 존재했다 — 직접 확인:
  `git show 7cfbf2557 -- use-widget.ts` 의 diff 어디에도 `seedWaitingFromStatus` 함수 바디(524~570번대
  라인)에 대한 hunk 가 없다. 이번 fix 는 **순수 호출부(call-site) 배선**이다.
- **JSDoc 2곳** — 커밋 메시지가 스스로 "JSDoc 2곳의 '~는 world 축만 필요' 반증된 서술도 정정" 이라 밝힌
  그대로, `beginBootAttempt` 인접 블록 1곳 + `seedWaitingFromStatus` `@param attempt` 블록 1곳, 정확히
  2곳만 수정됐다. 세 번째 JSDoc/주석 변경은 없다.
- 프로덕션 코드 hunk 안에 6줄짜리 설명 주석이 스냅샷 캡처 줄 바로 위에 붙어 있으나, 이는 이 파일/이
  plan 이 스스로 반복 지적하는 "JSDoc 인접성 유실 버그가 2회 재발"(`webchat-usewidget-extraction.md`)
  이력에 대한 방어적 관행과 일치하고, 정확히 "왜 이 줄이 필요한가"만 서술한다 — 범위 밖 설명이나
  일반론 확장은 없다.
- 신규 테스트(`use-widget-eager-start.test.ts`, +93줄)는 **정확히 1개**의 `it()` 블록이며, CRITICAL 로
  지적된 재현 시나리오(3-way race: start() 의 지연 seed vs 재전송의 복원 분기)만을 검증한다. 기존
  테스트에 대한 수정은 이 커밋에 없다(신규 추가만, `git show --stat` 확인: `93 ++...` 전부 `+`).

**결론**: 지시된 "스냅샷 캡처 1줄 + 인자 1개 + JSDoc" 특성과 실측이 정확히 일치한다. 기능 확장·불필요한
리팩토링·무관한 수정 없음.

### WARNING 정합 (`a2cd6ebb7`) — 23_58_23 WARNING 목록과 1:1 대조: **확인됨**

23_58_23 RESOLUTION.md 가 나열한 WARNING 6건(테스트 주석 되돌림 서술·plan 일어난 적 없는 단계·SSE 단언
갭·`useEiaSession` 이월·trailing whitespace·JSDoc 인접성[이월])을 실제 diff 와 대조:

| WARNING 항목 | 처리 파일 | 실측 대조 |
| --- | --- | --- |
| 테스트 주석이 되돌려진 C1 메커니즘 서술 | `use-widget-eager-start.test.ts` | 정확히 그 3곳(§3(재전송) 테스트 상단 주석 2개 hunk + 인라인 주석)만 재작성, 로직 변경 없음 |
| plan 의 "§106→§3(재전송) 39건"(일어난 적 없는 단계) | `webchat-boot-single-flight.md` | 2단계 서술로 정정(§106→§110→§3(재전송)) — 정확히 그 지점만 |
| 새로고침 복원 테스트 SSE 단언 갭 | `use-widget-eager-start.test.ts` | `esBeforeReload`/`esAfterReload` 2줄 추가, 기존 단언 유지 |
| `useEiaSession` 산문 이월 | `webchat-usewidget-extraction.md`(신규) + `webchat-boot-single-flight.md` 1문단 갱신 | 신규 plan 은 순수 문서, 코드 0줄 |
| trailing whitespace 빈 줄 | `use-widget.ts` | 공백-only 1줄 삭제, 그 외 변경 없음(`git show --stat`: `1 -`) |
| JSDoc 인접성 구조적 가드 | — | 코드 변경 없이 `webchat-usewidget-extraction.md` 체크리스트에만 기록(이월) — 지시대로 "범위 밖"으로 유보, 조기 구현 없음 |

6건 전부가 처리 파일·처리 내용 양쪽에서 RESOLUTION.md 의 서술과 정확히 일치한다. WARNING 목록에 없는
파일(예: `widget-state.ts`, `CHANGELOG.md`, 백엔드/프론트엔드)에 대한 터치는 없다.

### 재현 테스트 lint 수정 (`213561c3f`) — 순수 무기능 리팩토링: **확인됨**

`CountingES`(인라인 커스텀 클래스, `latestEs = this` 로 `no-this-alias` 위반)를 파일에 **이미 존재하는**
`installControllableEventSource()`(L84-97)와 동일한 "constructor 가 다른 인스턴스를 반환" 패턴으로
교체하고 생성-횟수 카운터만 얹었다. 새 패턴을 발명하지 않고 파일 기존 관행을 재사용했다는 점에서
오히려 일관성이 개선됐다. 대조 결과:

- 변경 파일 1개, 16줄 교체(`git show --stat`: `32 +++++++++++++++----------------`) — 해당 `it()` 블록의
  EventSource stub 정의부(약 16줄)만 hunk 에 포함, 그 아래 `webhookResolvers`/`statusResolvers`/단언문은
  diff 컨텍스트로만 나타나고 실제 변경 없음.
- 단언 대상(`esCount`, `result.current.state.pending?.nodeId`)·기대값 전부 이전과 동일 — 커밋 메시지의
  "동작·단언 불변" 주장과 실측 일치.
- config·eslint 룰 완화(`eslint-disable` 추가 등)로 회피하지 않고 코드 자체를 고쳐 근본 해결한 점도
  scope 관점에서 바람직하다(억제가 아니라 수정).

### review 산출물 커밋(`e62530291`, `5eed8cf96`) — 순수 문서: **확인됨**

- `e62530291`: `review/code/2026/07/17/23_58_23/` 하위 12개 파일 **전부 신규 생성**(`git show --stat`
  확인, 코드 파일 0줄). 리뷰 라운드의 표준 산출물 구조(SUMMARY/RESOLUTION/개별 리뷰어 md/meta.json/
  _retry_state.json)와 일치.
- `5eed8cf96`: `RESOLUTION.md` 1개 파일, 9줄 추가/1줄 삭제 — "[검증 갱신]" 섹션에 전체 스택(lint/unit/
  build/e2e) 재실행 수치를 append. 다른 리뷰 산출물이나 코드 파일에 대한 터치 없음.

두 커밋 모두 `review/**` 바깥을 건드리지 않아 코드 스코프에는 영향 없음.

### [INFO] 작업 트리 일시적 미커밋 변경 관찰 — 커밋 diff 에는 없음, 정보 제공 목적

리뷰 도중 `git status` 로 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 에
**미커밋 수정**(신규 테스트의 `expect(esCount).toBe(1)` 과 `expect(result.current.state.pending?.nodeId)
.toBe("n2")` 두 단언문의 순서 교환, 의미상 무영향)이 잠시 나타났다가 이후 재확인 시 스스로 사라졌다
(파일 mtime 이 확인 시점 기준 10초 이내로 매우 근접 — 진행 중이던 별개 프로세스가 되돌린 것으로 보임).

- 이는 **커밋된 diff 의 일부가 아니다** — 위 페이로드 청결 확인(merge-base/origin-main 비교)은 이
  변경을 포함하지 않는다(두 명령 모두 커밋 간 비교라 작업트리 미커밋 변경은 원천적으로 안 잡힌다).
- 공유 worktree 에서 여러 리뷰어 sub-agent 가 동시에 동작할 때 발생하는 것으로 알려진 관측 아티팩트
  패턴과 일치한다(격리되지 않은 worktree 에서의 동시 mutation-testing 부산물 가능성). 실측 코드 변경도,
  프로덕션 로직 변경도 아니었고 커밋 이력에도 반영되지 않았다.
- **이번 스코프 판정(아래 위험도)에는 반영하지 않는다** — 심사 대상은 커밋된 diff 이고 이 아티팩트는
  거기 없다. 다만 오케스트레이터는 최종 push 전 `git status`/`git diff` 로 작업트리가 clean 한지
  재확인할 것을 권고한다(우연히 그 시점에 커밋되면 의도치 않은 노이즈가 diff 에 섞일 수 있다).

## 확인된 것 (문제 없음)

- 41개 파일 전수(`mb_files.txt`) 구성이 이 브랜치의 개발 이력(§106/§3(재전송) 기능 + 18_39_11/23_58_23
  리뷰 라운드 + 19_46_54 consistency-check)과 정합 — 백엔드·프론트엔드·다른 패키지·CI/lint 설정 파일
  터치 0.
- 델타 5개 커밋 전부가 debug 잔재(`console.log`/`TODO`/`FIXME`/`debugger`) 없음 (`grep` 로 직접 확인).
- 델타 5개 커밋 전부가 `package.json`/`tsconfig`/`eslint config`/`vitest config` 등 설정 파일 0줄 —
  "설정 변경" 카테고리 위반 없음.
- CHANGELOG.md 는 이번 델타 5개 커밋 어디에도 등장하지 않는다 — 이는 스코프 위반이 아니라(추가 안 된
  것은 "의도 이상의 변경"이 아니다), 완결성(완전성) 문제라면 documentation/requirement 리뷰어 영역.

## 요약

23_58_23 리뷰 이후의 실제 델타는 정확히 5개 커밋(`7cfbf2557`/`a2cd6ebb7`/`213561c3f`/`e62530291`/
`5eed8cf96`)이며, 건드린 고유 파일도 정확히 16개(코드/테스트/plan 4개 + review 산출물 12개)로 지시된
4개 범주(start() fix·WARNING 정합·lint 수정·review 산출물) 밖으로 한 발짝도 나가지 않는다. 특히 핵심
질문이었던 start() fix 의 최소성은 실측으로 확인된다 — 프로덕션 코드는 스냅샷 캡처 1줄과 인자 1개
추가뿐이고, `seedWaitingFromStatus` 함수 자체는 이 커밋에서 전혀 수정되지 않았다(이미 존재하던
`attempt` 파라미터에 세 번째 호출부가 배선됐을 뿐). JSDoc 정정도 커밋 메시지가 예고한 "정확히 2곳"과
일치한다. WARNING 정합 커밋도 23_58_23 RESOLUTION 의 6개 항목과 파일·내용 양쪽에서 1:1 대응하며, 목록에
없는 파일은 건드리지 않았다. lint 수정 커밋은 파일 기존 관행을 재사용한 순수 무기능 리팩토링이고, 두
개의 docs(review) 커밋은 `review/**` 바깥에 0줄 영향이다. 리뷰 도중 관찰된 작업트리의 일시적 미커밋
변경은 커밋 diff 밖의 별개 현상(스스로 사라짐, 공유 worktree 동시성 아티팩트로 추정)이라 이번 판정에
반영하지 않았다.

## 위험도

NONE
