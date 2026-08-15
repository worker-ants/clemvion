# Rationale 연속성 검토 — spec/5-system/ (EIA "DB=wire" invariant 마무리 라운드)

## 조사 방법 메모

`prompt_file` 의 번들은 diff 실체(`<git diff origin/main...HEAD -- code_areas>`)와 대부분의
`spec/5-system/*` 본문을 컨텍스트 예산 초과로 생략했다. 실제 저장소(HEAD =
`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, branch
`claude/eia-db-wire-invariant`, 최신 커밋 `bf0f86ca8`)를 `git diff origin/main...HEAD`·
`git show <sha>`·`Read` 로 직접 열어 보완했다. 이번 diff 는 EIA 종결 이벤트의
"DB = wire" 불변식을 닫는 3개 소결함(①`finalizeCancelledExecution` 미확인 emit,
②retry-turn CANCELLED 재진입 `durationMs` 불일치, ③REST 재조회 `durationMs` 부재) 수정과,
같은 세션 안에서 그 수정 자체를 두 번 더 교정한 커밋(`b4d0ca27e`, `bf0f86ca8`)들로
구성된다.

---

## 발견사항

### [CRITICAL] `spec/conventions/node-cancellation.md` §2.4 매트릭스·Rationale 이 방금 코드가
### 스스로 부정한 "동형(unconditional skip)" 서술을 여전히 담고 있다

- **target 위치**: `spec/conventions/node-cancellation.md:198`(§2.4 구현 현황 표,
  `finalizeCancelledExecution` 행) 및 `:209-217`(`## Rationale` "왜 취소 시각 보존
  메커니즘이 두 가지인가" 첫 항목, 2026-08-15 정정 노트 포함)
- **과거 결정 출처**: (a) 같은 파일 같은 라인 — 이 표·문단 자체가 이번 세션의 커밋
  `692dfa00e`("fix(eia): DB 에 쓰이지도 않은 종결 이벤트를 발행하고 있었다")가 새로 쓴
  "합의된 원칙"이다. (b) 그 직후 커밋 `b4d0ca27e`("fix(eia): 내 첫 수정이 사용자가 누른
  Stop 을 침묵시켰다")와 `bf0f86ca8`("fix(eia): 자매 주석에 극성 캐비엇")가
  `execution-engine.service.ts` 의 `finalizeCancelledExecution`/`finalizeFailedExecution`
  코드·JSDoc·인라인 주석에 이 (a)의 서술이 틀렸다고 명시적으로 기록했다.
- **상세**: `692dfa00e` 시점 코드는 `finalizeCancelledExecution` 이 guarded UPDATE 0행
  (`!persisted`)이면 **무조건** `logger.warn` 후 `return`(emit 안 함) 이었다 — 그래서 그때
  node-cancellation.md 에 쓴 "0행이면 CANCELLED 재마킹·`EXECUTION_CANCELLED` emit 을
  **모두 skip**. 자매 `finalizeFailedExecution` 과 **동형**" 은 그 시점엔 사실이었다.

  그런데 바로 다음 커밋 `b4d0ca27e` 가 그 "무조건 skip" 자체를 **결함**이라고 판정하고
  코드를 바꿨다: `stop()` 은 RUNNING/PENDING 경로에서 이벤트를 쏘지 않으므로(WAITING 만
  `cancelParkedExecution` 이 emit) `finalizeCancelledExecution` 이 **유일한 알림 지점**인
  경우가 있는데, "0행이면 무조건 skip" 은 그 경로를 침묵시켜 **사용자가 누른 Stop 이
  외부 수신자에게 영영 전달되지 않는** 회귀를 냈다(커밋 메시지: *"내 첫 수정... 은 사용자가
  실행 중 워크플로를 Stop 했을 때 외부 수신자에게 아무 통지도 안 가게 만들었다. 고치려던
  결함보다 나쁘다"*). 수정된 현재 코드(HEAD, `execution-engine.service.ts:4899-4929`):

  ```ts
  const persisted = await this.updateExecutionStatus(savedExecution, ExecutionStatus.CANCELLED);
  if (!persisted) {
    const live = await this.executionRepository.findOneBy({ id: savedExecution.id });
    if (live?.status !== ExecutionStatus.CANCELLED) {
      this.logger.warn(/* ... 다른 종결자 선점 — emit skip ... */);
      return;                       // (b) DB가 FAILED/COMPLETED → skip
    }
    // (a) DB가 이미 CANCELLED(=stop()의 정상 마감) → 값만 DB 정본으로 맞추고 계속 진행
    savedExecution.durationMs = live.durationMs ?? savedExecution.durationMs;
    savedExecution.finishedAt = live.finishedAt ?? savedExecution.finishedAt;
  }
  await this.emitCancellationEvent(savedExecution.id, { ... });   // (a) 경로는 여기 도달 → emit 됨
  ```

  즉 **0행이라고 emit 이 "모두" skip 되지 않는다** — case (a)(라이브 상태가 이미
  CANCELLED)에서는 재조회 후 **발행한다**. `execution-engine.service.spec.ts` 에 이번
  diff 로 추가된 회귀 테스트(`describe('finalizeCancelledExecution — 0행 매칭의 두 의미')`)가
  이 분기를 정확히 고정한다: `(a) DB 가 이미 cancelled — ... emit 한다` /
  `(b) DB 가 failed — ... 쏘지 않는다`.

  같은 커밋(`bf0f86ca8`)이 자매 `finalizeFailedExecution` 의 주석에도 이 비대칭을
  명시적으로 못박았다: *"`!persisted` 이후는 극성이 반대다. ... 형제는 반대로 0행이
  `stop()` 이 이미 마감했다를 뜻할 수 있고 ... 재조회해 CANCELLED 면 발행한다. 이 함수를
  본떠 새 guarded 경로를 만들 때 무조건 skip 을 기본으로 가정하지 말 것 — 실제로 그렇게
  복사해 사용자가 누른 Stop 이 무음이 됐다."*

  그런데 이 두 교정 커밋(`b4d0ca27e`, `bf0f86ca8`) **어느 쪽도
  `spec/conventions/node-cancellation.md` 를 건드리지 않았다**
  (`git show <sha> --stat` 로 확인 — 두 커밋의 변경 파일 목록에 이 파일이 없음). 그 결과
  HEAD 현재, 이 컨벤션 문서는 여전히 "0행이면 emit 을 **모두** skip" · "자매와 **동형**"
  이라고 적고 있다 — 코드가 방금 그 두 단어(모두, 동형)를 정확히 반증한 상태다.

  이 패턴은 이 문서·이 세션이 스스로 "저장소가 이미 세 번 CRITICAL 로 잡은 결함 클래스"
  (`CHANGELOG.md:477`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:238`)라고
  기록한 **"문서한 보장이 구현보다 넓다"** 유형 그 자체다 — 그리고 이 파일의 바로 옆
  줄(213~217행)이 "같은 표의 자매 행은 정확히 적혀 있었는데 **이 행만** 보장을 구현보다
  넓게 서술했다"고 방금 자기 자신을 정정한 직후, 코드가 다시 바뀌면서 **같은 종류의
  과대서술이 재발**했다. 향후 이 표를 "guarded terminal path" 구현 템플릿으로 참조할
  개발자가 "동형=무조건 skip" 을 그대로 복제하면, 이번 세션이 이미 한 번 만들었던
  "Stop 이 무음이 되는" 회귀를 재현하게 된다.

  **참고(상반된 선행 판단)**: 직전 코드 리뷰 라운드(`review/code/2026/08/15/14_47_14/requirement.md`
  INFO 항목, 위치 `73-89`행)는 이 파일 `:198`·`:209-217` 를 "구현과 line-level 로 일치"
  "조치 불요" 로 판정했다. 그 판정은 같은 문서의 다른 INFO 항목(15~27행)에서 코드가
  "의도적으로 비대칭(자매는 무조건 skip, 이쪽은 재조회 후 조건부 emit)" 이라고 명시적으로
  확인해 놓고도, node-cancellation.md 의 "모두 skip"/"동형" 문구 자체는 그 비대칭과
  대조 검증하지 않은 것으로 보인다 — 0행 매칭이 "사실"이라는 표면적 사실만 확인했다.

- **제안**: §2.4 표 198행과 Rationale 209~217행을 코드의 실제 비대칭에 맞춰 재정정한다.
  예시 문구: *"조건부 UPDATE 가 0행이면 재조회한다 — DB 가 이미 CANCELLED(=`stop()` 정상
  마감)면 값을 DB 정본으로 맞춘 뒤 **발행**하고, FAILED/COMPLETED(다른 종결자 선점)면
  **skip** 한다. 자매 `finalizeFailedExecution` 과 진입점(반환값을 읽는다는 점)은 같지만
  `!persisted` 이후 처리는 **극성이 반대**다(자매는 무조건 skip) — 동형이 아니다."*
  이미 있는 취소선+정정노트 관행(577행, 816~824행과 동일 패턴)을 그대로 재사용하면 된다.
  `plan/in-progress/eia-db-wire-invariant.md:63-68` 의 체크박스(`[x] node-cancellation.md
  정정`)도 이 재정정이 끝나기 전까지는 완결로 보기 어렵다 — 그 항목이 닫은 것은
  `692dfa00e` 시점의 과대서술이었고, 이후 `b4d0ca27e`/`bf0f86ca8` 가 코드를 다시 바꿔
  같은 문구를 다시 부정확하게 만들었다.

---

## 확인된 정합 사항 (참고 — 위반 아님)

- `spec/5-system/14-external-interaction-api.md` §6.5 "알려진 예외 1건" 취소선+해소 노트
  (`:816-824`)는 같은 파일 577행의 기존 관행("취소선으로 옛 문구를 보존한 채 해소 시점·근거를
  덧붙인다")을 정확히 재사용한다 — 원문 삭제 없음.
- §5.3 `GET /api/external/executions/:executionId` 응답에 `durationMs` 추가(`EIA-IN-04`,
  본문 예시)는 R17 이 세운 "REST = 현재 표면 시드 + 새로고침 복원(durable 컬럼 그대로 노출)"
  역할 분담과 정합하며, `seq` 를 placeholder 로 남겨두는 기존 결정과 충돌하지 않는다(`seq`
  는 in-memory 카운터라 REST 에서 접근 불가라는 이유가 여전히 유효하고, `durationMs` 는
  영속 컬럼이라 그 제약이 적용되지 않는 별개 필드).
- `interaction.service.ts` 의 `durationMs: execution.durationMs ?? null`(present-when-terminal,
  종결 전 `null`)은 API 규약 §5.4 "부재 표현 — `null` vs 키 생략" 및 R17 의 형제 필드
  (`currentNode`/`result`/`error`) 패턴과 동일한 표현을 쓴다 — 신규 표현 방식 도입 아님.
- retry-turn CANCELLED 분기의 `.returning(['duration_ms', 'finished_at'])` 되읽기는
  node-cancellation.md Rationale 의 "SQL `COALESCE` 로 SELECT–UPDATE 창을 신뢰하지 않는다"
  는 기존 근거를 그대로 실현한다 — 새 원칙 도입이 아니라 기존 원칙의 완성.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 처방 정정(①의 근본
  원인을 "`RETURNING` 부재"에서 "반환을 읽지 않음"으로, 그리고 재차 "동형이 아니라 극성
  반대"로 갱신)은 이 저장소의 "실측 후 정정, 날짜 명시" 관행을 그대로 따르는 모범 사례다 —
  다만 그 정정이 자매 문서(node-cancellation.md)까지 전파되지 않은 것이 위 CRITICAL 이다.
- `finalizeGuarded` 5단 중첩·QB mock 중복, `Execution` 엔티티 nullable 불일치 등은
  `plan/in-progress/eia-db-wire-invariant.md` "## 범위 밖 (등재됨)" 절에 사유와 함께
  명시적으로 defer 되어 있다 — 무근거 유보가 아니다.

---

## 요약

이번 diff 의 핵심 개조(①②③)는 EIA "DB=wire" 불변식이라는 기존 원칙을 더 정밀하게
실현하는 방향이며 대체로 과거 Rationale(R14/R17, §6.5 known-gap 관행, node-cancellation.md
의 COALESCE 근거)과 정합한다. 그러나 같은 세션 안에서 `finalizeCancelledExecution` 의
동작을 두 번 더 교정하면서(무조건 skip → 조건부 재발행) `spec/conventions/node-cancellation.md`
§2.4 매트릭스·Rationale 을 갱신하지 않아, 이 컨벤션 문서가 현재 코드가 명시적으로 부정한
"자매와 동형(무조건 skip)"이라는 문구를 그대로 담고 있다. 이는 이 저장소가 이미 "세 번
CRITICAL"로 겪었다고 자인한 "문서한 보장이 구현보다 넓다" 결함 클래스의 재발이며, 이
문서를 그대로 신뢰해 새 guarded-path 를 만들면 이번 PR 이 이미 한 번 만들었던 "사용자
Stop 무음화" 회귀를 재현할 수 있다.

## 위험도

CRITICAL
