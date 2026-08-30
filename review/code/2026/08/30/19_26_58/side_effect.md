# 부작용(Side Effect) 코드 리뷰

## 검증 방법

`meta.json` 대상 42파일 중 실제 프로덕션 코드는 `execution-engine.service.ts`/`.spec.ts` 뿐이고,
나머지는 `CHANGELOG.md`·plan 3건·spec 2건·`review/**` 산출물(17_36_15·18_10_28·17_49_59 라운드가
남긴 문서)이다. 이번 라운드의 최신 커밋 `9d5e001bf`(`git show 9d5e001bf`)를 직접 열어 diff 를
확인했고, 서비스 파일은 프롬프트에서 diff 가 생략돼 `Read`/`grep` 으로 원본을 직접 열어 대조했다.
저장소에 뮤테이션은 가하지 않았다(`git status --short` 확인 — untracked 는 이 리뷰 세션 자신의
출력 디렉터리뿐).

## 발견사항

- **[INFO]** self-deadlock 회피 근거가 여전히 **어휘적(lexical) 범위**에 한정된다 — 이번 라운드가 새로 만든 갭이 아니라, 이번 커밋이 스스로 그 한계를 명시한 것
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus` JSDoc, "호출부는 **20곳**이다" 문단(함수 시그니처 `public async updateExecutionStatus(` 바로 위 블록)
  - 상세: 직전 라운드(`18_10_28`)의 WARNING("11곳 전수 대조" 라는 문구가 실제로는 이 파일 내부 직접 호출 11곳만 센 것이고 `EngineDriver` 경유 9곳을 빠뜨렸다)이 이번 커밋(`9d5e001bf`)에서 정정됐다. `grep -rn "\.updateExecutionStatus(" codebase/backend/src` 로 직접 재검증한 결과 파일 내부 직접 호출 11 + driver 경유 9(`ai-turn-orchestrator.service.ts` 3·`retry-turn.service.ts` 2·`form-interaction.service.ts` 2·`button-interaction.service.ts` 2) = 20 이 정확했고, `retry-turn.service.ts` 의 유일한 `dataSource.transaction` 블록(215행 시작)이 driver 호출 지점(696·915행)보다 한참 앞서 닫혀 20곳 모두 트랜잭션 콜백 밖이라는 서술도 실측과 일치했다. 다만 새 JSDoc 스스로 "호출 스택 위쪽에서 트랜잭션을 연 caller 가 있는지까지는 보지 않았다" 고 명시하듯, 이 확인은 여전히 어휘적 범위이며 self-deadlock 이 실제로 불가능함을 증명하지는 않는다. 이는 이번 커밋이 스스로 좁혀 적은 한계이고, 두 라운드 전(`17_36_15`) concurrency 리뷰어가 처음 지적했을 때부터 있던 성격의 리스크라 이번 diff 가 새로 도입한 것은 아니다.
  - 제안: 조치 불요. 이미 JSDoc 이 한계를 정직하게 명시하고 있어 다음 사람이 "완전히 증명됐다" 로 오인할 위험은 낮다. 새 `updateExecutionStatus` 호출부가 추가될 때 호출 스택 상위의 트랜잭션 여부까지 보라는 문구도 이미 있다.

- **[INFO]** 이번 라운드의 코드 변경은 순수 문서(JSDoc) 정정 1건뿐 — 런타임 동작·시그니처·전역 상태 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`9d5e001bf` diff, 함수 시그니처 윗줄 JSDoc 블록만 변경)
  - 상세: `git show 9d5e001bf`로 확인한 결과 이 커밋이 건드린 코드 파일은 `execution-engine.service.ts` 하나뿐이고, 변경은 전부 `/** ... */` 주석 블록 내부다. 함수 시그니처(`execution, newStatus, linkedNodeExec?, opts?`) · 반환 타입(`Promise<boolean>`) · 트랜잭션 배선 · epilogue 호출 순서는 이전 라운드(`1a12088f2`, `519671792`)에서 이미 고정된 그대로다. `execution-engine.service.spec.ts` 는 이 커밋에서 변경되지 않았다(spec 변경은 `1a12088f2`에서 끝났고, 이후 두 커밋은 JSDoc·plan·review 산출물뿐).
  - 제안: 조치 불요. 확인 목적의 기록.

- **[INFO]** `review/consistency/2026/08/30/17_49_59/plan_coherence.md` 의 sub-agent 프로토콜 헤더(`STATUS=…`/`===REPORT_MARKDOWN_BELOW===`) 누출이 이번 커밋으로 제거됨 — 파일시스템 콘텐츠 정정, 부작용 아님
  - 위치: `review/consistency/2026/08/30/17_49_59/plan_coherence.md:1-2`
  - 상세: 직전 라운드 WARNING(`18_10_28` W2)이 지적한, 리뷰 산출물 본문에 프로토콜 잡음이 새어 든 사례를 `9d5e001bf`가 이 1건만 정정했다(직접 `head -5`로 확인 — 현재 1번째 줄이 정상적으로 `# Plan 정합성 검토 — ...` 로 시작). 같은 클래스의 나머지 824건은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 「후속」 섹션에 등재되고 이번 diff 에 포함되지 않는다 — 무관한 대량 정리를 같은 커밋에 섞지 않는다는 이 저장소의 확립된 관례를 지킨 것으로, 예상치 못한 대량 파일시스템 부작용이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 핵심 트랜잭션화 변경(`1a12088f2`) 자체의 부작용 배선은 두 이전 라운드(`17_36_15`, `18_10_28`)에서 이미 상세 검증됐고, 이번 라운드 재확인 결과 일치
  - 위치: `execution-engine.service.ts:8709-8779` (`updateExecutionStatus` else 분기의 `dataSource.transaction` 래핑 + 공유 `finishStatusTransition` 헬퍼)
  - 상세: 직접 `Read` 로 재확인 — `emitTerminalExecutionMetrics`/`recordRunningSegmentStart`(둘 다 부작용: 메트릭 발행 · in-memory 세그먼트 기록)는 `finishStatusTransition` 헬퍼 안에 있고, 두 분기(`linkedNodeExec` 분기·else 분기) 모두 `await this.dataSource.transaction(...)` 이 완전히 resolve(=commit)된 **이후에만** 이 헬퍼를 호출한다 — 트랜잭션 콜백 밖에서 부작용이 발생해 롤백된 쓰기에 대해 메트릭/세그먼트 기록이 나가는 경로는 없다. 이 헬퍼 추출 자체가 "형제 분기 손 복제" WARNING(`17_36_15` maintainability W2)의 처방이었고, 순서 보존은 `18_10_28` side_effect 라운드가 이미 확인한 바와 동일하다. 새로 발견된 이상은 없다.
  - 제안: 조치 불요.

## 요약

이번 라운드(`19_26_58`)의 실제 diff 는 `9d5e001bf` 한 커밋으로, 프로덕션 코드에서는 `updateExecutionStatus` JSDoc 문구("11곳 전수 대조" → "20곳, 어휘적 범위" 로 정정) 하나만 바꿨을 뿐 함수 시그니처·트랜잭션 배선·부작용 순서·전역 변수·환경 변수·네트워크 호출은 전혀 손대지 않았다. 직접 재실측(`grep`)한 결과 정정된 "20곳" 수치와 "전부 트랜잭션 콜백 밖" 주장은 정확했다. 리뷰 산출물의 프로토콜 헤더 누출 1건도 이번 커밋이 그 1건만 정정했고 무관한 대량 정리를 섞지 않아 예상 밖 파일시스템 부작용은 없다. `1a12088f2`가 도입한 핵심 변경(else 분기 guarded UPDATE 를 `dataSource.transaction` 으로 감싸 shape-위반 throw 시 실제 롤백을 보장) 은 이미 두 라운드에 걸쳐 부작용 관점에서 상세 검증됐고, 이번 재확인에서도 메트릭 발행·세그먼트 기록이 트랜잭션 커밋 이후에만 실행되는 순서가 그대로 유지되고 있음을 소스에서 직접 확인했다. 유일하게 남는 관측은 self-deadlock 회피 근거가 여전히 "어휘적 범위" 라는 스스로 명시한 한계인데, 이는 이번 diff 가 새로 만든 리스크가 아니라 두 라운드 전부터 있던 것을 정직하게 좁혀 적은 것이다.

## 위험도

NONE
