# 부작용(Side Effect) Review — review/code/2026/07/26/16_20_52 (7R)

## 검증 방법

프롬프트의 diff-list(48개 파일)는 전부 `review/code/2026/07/26/{13_47_42,14_45_30,15_30_00,15_56_53}/**`
아래 과거 라운드 리뷰 산출물(`.md`/`.json`)이며, 이번 라운드(7R)가 실제로 검토해야 할
`codebase/**` 소스 diff 는 프롬프트에 포함돼 있지 않았다(harness diff-list 갭 — 6R까지도 반복
관측된 현상, 이미 harness 백로그로 분리된 기지 항목). 지시대로 `git show HEAD`로 직접 열었다.

HEAD(`3428129b1`, "fix(engine): 6R W26·W27 — JSDoc 고아 해소 + error 키 부재 불변식 결속")의
`codebase/**` 변경은 정확히 2개 파일이다.

## 발견사항

이번 라운드(7R)가 검토 대상으로 하는 HEAD 커밋의 소스 변경 2건 모두에서 **신규 부작용을
발견하지 못했다.**

### 1) `execution-engine.service.ts` — 순수 JSDoc 블록 이동 (부작용 없음, 확인됨)

`git show HEAD -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts`로
diff 전체를 확인했다. 변경은 단일 hunk(`@@ -4548,26 +4548,6 @@` ~ `@@ -4614,6 +4594,26 @@`)이며,
내용은 `finalizeCancelledExecution`의 JSDoc 주석 블록(20줄, `/** ... */`, 코드 아님)을
- 기존 위치: `markNodeCancelled`의 JSDoc **바로 앞**(= 두 함수의 JSDoc이 빈 줄 없이 연속돼
  `finalizeCancelledExecution`이 자기 문서와 47줄 떨어진 상태, W26이 지적한 원인)
- 이동 후 위치: `markNodeCancelled`의 함수 본문(닫는 `}`) **뒤**, `finalizeCancelledExecution`의
  `private async` 선언 **바로 앞**

으로 옮긴 것이 전부다. 삭제된 20줄과 추가된 20줄의 텍스트를 diff에서 직접 대조한 결과 **문자
그대로 동일한 JSDoc 블록**이며, 코드 실행문(대입·호출·조건·`return`/`throw` 등)은 이 hunk
안에 전혀 없다 — 순수 주석 재배치다. 이동 후 상태를 `Read`/`Grep`으로도 재확인했다(
`markNodeCancelled` 선언 `:4566`, `finalizeCancelledExecution` 선언 `:4617` — RESOLUTION.md의
실측치와 일치).

JSDoc 주석은 런타임에 평가되지 않으므로(TypeScript/JavaScript 파서가 토큰화 시 버리는 trivia),
- 실행 순서: 무변화 (주석은 실행 흐름에 개입하지 않음)
- 스코프: 무변화 (두 함수 모두 같은 클래스 멤버 위치, 함수 선언 순서 자체는 바뀌지 않음 —
  `markNodeCancelled`가 여전히 `finalizeCancelledExecution`보다 앞에 선언됨)
- 클로저 캡처: 무변화 (클래스 메서드 선언 순서/문서 위치는 `this` 바인딩이나 캡처 변수에 영향
  없음 — 클로저를 만드는 코드 자체가 이 hunk에 없음)

프롬프트 지시(§ "HEAD 커밋의 .ts 변경이 순수 블록 이동이라면 부작용도 없어야 한다")에 대한
답: **사실로 확인됨.** 부작용 없음.

### 2) `execution-engine.service.spec.ts` — 기존 테스트에 단언 2줄 추가 (부작용 없음)

`git show HEAD -- codebase/backend/.../execution-engine.service.spec.ts`로 확인. 변경은 기존
"Sub-workflow 취소" 테스트 케이스 내부에 다음 두 줄을 삽입한 것이 전부다(순수 추가, 기존 줄
삭제·수정 없음):

```ts
expect(ne?.error).toBeUndefined();
expect(cancelCall?.[3]).not.toHaveProperty('error');
```

- 테스트 전용 코드이며 프로덕션 런타임에 전혀 포함되지 않는다.
- `ne`/`cancelCall`은 삽입 지점 위에서 이미 선언된 `const`를 재사용할 뿐, 새 mock·새 전역
  상태·새 fixture를 도입하지 않는다.
- 검증 방향이 "특정 필드가 **존재하지 않아야 함**"이라 다른 단언의 부수효과(예: mock 호출
  카운트 변화)를 만들지 않는다 — 순수 read-only assertion.
- 같은 테스트 파일의 다른 `it()` 블록이나 `describe()` 블록에 영향을 주는 공유 mock 초기화
  코드는 이 hunk 밖에 있고 이번 변경으로 건드리지 않았다.

시그니처·공개 인터페이스·환경 변수·파일시스템·네트워크·이벤트/콜백 어느 축에도 해당 사항
없음.

### 3) `review/**` 아카이브 변경 — 의도된 워크플로 산출물 (부작용 아님)

같은 커밋에 `review/code/2026/07/26/15_29_59/meta.json` 삭제(-282, RESOLUTION.md가 이미
"빈 세션 정리"로 명시한 하우스키핑과 동일 패턴), `15_56_53/` 아래 신규 리뷰 산출물
(`RESOLUTION.md`/`SUMMARY.md`/`meta.json`/관점별 `.md`) 추가, `_retry_state.json` rename이
포함돼 있다. 전부 프로젝트 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)이 명시하는
정규 산출 위치이며, 소스 코드 변경과 무관한 리뷰 워크플로 부산물이다. 예상치 못한 파일시스템
부작용 아님.

## 재론하지 않는 항목 (이미 해소 확인됨)

- W9(컨테이너 catch-all 취소 오분류), W14(스로틀 Map background 누수), W15/W19(영구
  running·vacuous 단언), W16(retry-turn error 노출), W20(retry 정책 취소 오분류), W25(취소
  종결 중복 → `markNodeCancelled` 추출, payload 키 집합·순서·객체 참조 동일성까지 확인됨) —
  전부 이전 라운드(1R~6R)에서 side_effect 또는 타 관점이 이미 검증 완료했고, 이번 HEAD
  diff는 그 로직들을 재변경하지 않았다(JSDoc 위치 이동과 테스트 단언 추가만). 다시 들추지
  않는다.

## 요약

이번 라운드(7R)가 검토해야 할 실제 소스 변경은 `execution-engine.service.ts`의 JSDoc 블록
재배치(코드 로직 무변경) 1건과 `execution-engine.service.spec.ts`의 단언 2줄 추가(테스트
전용) 1건뿐이다. 두 변경 모두 실행 순서·스코프·클로저 캡처·함수 시그니처·공개
인터페이스·전역 상태·환경 변수·파일시스템·네트워크 호출·이벤트/콜백 어느 축에도 영향을
주지 않는다. JSDoc 이동은 문자 그대로 동일한 주석 텍스트를 옮긴 것이며 주석은 런타임에
평가되지 않으므로 "순수 블록 이동 → 부작용 없음"이라는 전제가 사실로 확인됐다. 새로 발견된
부작용은 없다.

## 위험도

NONE
