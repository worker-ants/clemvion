## 발견사항

### INFO — plan 문서 체크리스트 미갱신
- **위치**: `plan/in-progress/fix-continuation-bus-bootstrap-race.md`, 작업 항목 1·2 전체
- **상세**: 구현 코드(파일 1~4)는 완성됐으나 plan 의 모든 체크박스가 `[ ]`로 남아 있음. 단, 현재 리뷰가 plan §4 REVIEW WORKFLOW 단계이므로, 구현 완료 후 리뷰 전까지 미갱신인 것은 정상 흐름이다. 리뷰 종료 후 `plan/complete/`로 `git mv` 할 때 함께 정리하면 된다.
- **제안**: 리뷰 완료 및 이슈 조치 후 체크박스를 일괄 체크 처리하고 `plan/complete/`로 이동.

---

그 외 어떠한 범위 이탈도 발견되지 않았다.

| 관점 | 판정 |
|---|---|
| 의도 이상의 변경 | 없음 |
| 불필요한 리팩토링 | 없음 |
| 기능 확장(over-engineering) | 없음 |
| 무관한 파일/코드 수정 | 없음 |
| 포맷팅/공백 변경 혼입 | 없음 |
| 주석 변경 | plan 에 명시된 이유 주석만 추가 — 적절 |
| 임포트 변경 | `OnApplicationBootstrap` 단 1건, 필요한 추가 |
| 설정 파일 변경 | 없음 |

세부 변경 내역을 plan 의 4개 작업 항목과 1:1 대조하면 다음과 같다.

1. **ContinuationBusService 방어적 가드** — `publish` / `acquireLock` / `releaseLock` 각 진입부에 `if (!this.publisher)` 가드 추가. plan 명세 그대로 구현됨.
2. **가드 테스트** — `publisher 미초기화 가드 — race 방어` describe 블록 3건 추가. plan 명세 그대로 구현됨.
3. **recoverStuckExecutions 호출 시점 이동** — `onModuleInit` → `onApplicationBootstrap` 이전, 시그니처 `async` 제거, `OnApplicationBootstrap` import 추가. plan 명세 그대로 구현됨.
4. **라이프사이클 테스트** — `onModuleInit 은 recovery 를 트리거하지 않는다` / `onApplicationBootstrap 이 recovery 를 트리거한다` 2건 추가. plan 명세 그대로 구현됨.

추가 관찰: `onModuleInit` 시그니처를 `async onModuleInit()` → `onModuleInit(): void`로 변경한 것은 body 내 `await` 가 제거됐으므로 정확한 타입 표현이며, 범위 이탈이 아니다.

---

## 요약

4개 파일 모두 plan 문서(`fix-continuation-bus-bootstrap-race.md`)에 명시된 구현 항목과 정확히 일치한다. 추가적인 리팩토링, 기능 확장, 무관한 파일 수정은 전혀 없으며, 주석과 임포트 변경도 모두 해당 수정에 직접 필요한 것들만 포함되어 있다. 유일한 지적 사항은 plan 체크박스 미갱신이지만, 이는 현재 REVIEW WORKFLOW 진행 중이라는 정상 상태를 반영한 것으로 범위 위반에 해당하지 않는다.

## 위험도

**NONE**