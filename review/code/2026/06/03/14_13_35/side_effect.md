# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 정보성 항목

- **[INFO]** 변경 대상이 spec 문서(.md) 20개 전부임 — 실행 가능 코드 없음
  - 위치: 파일 1~20 전체
  - 상세: 이번 변경은 `spec/conventions/`, `spec/data-flow/` 하위 Markdown 문서에 대한 사실 동기화(spec-sync)다. TypeScript/Python/YAML/JSON 등 실행 가능한 코드 파일은 단 하나도 수정되지 않았다. 함수 시그니처, 전역 변수, 환경 변수, 파일시스템 접근, 네트워크 호출, 이벤트/콜백 등 런타임 부작용을 유발할 수 있는 요소가 존재하지 않는다.
  - 제안: 해당 없음.

- **[INFO]** spec frontmatter `code:` 목록 변경 — 가드 테스트(`spec-code-paths.test.ts`) 영향 가능
  - 위치: 파일 1(`interaction-type-registry.md`) — `code:` 에 3개 경로 추가; 파일 8(`user-guide-evidence.md`) — `code:` 에 3개 경로 추가 + `pending_plans:` 신규 추가; 파일 4(`node-output.md`) — `code:` 에 1개 경로 추가
  - 상세: `spec-code-paths.test.ts` 가드는 `status ∈ {partial, implemented}` 인 spec 의 `code:` 글로브가 ≥1 파일 매치 여부를 검증한다. 새로 추가된 경로들(`conversation-utils.ts`, `conversation-thread.types.ts`, `render-tool-provider.ts`, `execution-engine.service.ts`, `integrations-coverage.test.ts`, `triggers-coverage.test.ts`, `impl-anchor-parse.ts`)이 실제로 레포지터리에 존재하지 않으면 가드가 CI에서 실패할 수 있다. 그러나 이는 spec 문서의 선언적 메타데이터 오류이지 코드 부작용이 아니다.
  - 제안: 추가된 `code:` 경로 각각이 레포지터리에 실존하는지 별도 확인 권장 (spec-code-paths 가드가 자동 검증함).

- **[INFO]** `user-guide-evidence.md` status `implemented` → `partial` 강등 + `pending_plans:` 신규 추가
  - 위치: 파일 8, 라인 `status: partial`, `pending_plans: - plan/in-progress/spec-sync-user-guide-evidence-gaps.md`
  - 상세: `spec-pending-plan-existence.test.ts` 가드가 `pending_plans:` 경로의 실존을 검사한다. `plan/in-progress/spec-sync-user-guide-evidence-gaps.md` 가 실제로 존재하지 않으면 가드 실패. 이 역시 코드 부작용이 아니라 선언적 메타데이터 정합성 문제다.
  - 제안: 해당 plan 파일이 `plan/in-progress/` 또는 `plan/complete/`(치환 후)에 실존하는지 확인 필요.

- **[INFO]** `spec-impl-evidence.md` `pending_plans` 존재 검증 범위 완화 — `plan/complete/` 경로도 허용
  - 위치: 파일 6, `pending_plans` 필드 설명 변경
  - 상세: 가드 동작 정의를 완화하는 spec 변경이다. `spec-pending-plan-existence.test.ts` 의 실제 구현이 이미 `plan/complete/` 도 허용하도록 수정되어 있어야 한다. spec 문서가 테스트 코드보다 앞서 변경됐다면 테스트 코드 갱신이 필요할 수 있다. 단, 이는 테스트 동작 변경이지 프로덕션 코드 부작용이 아니다.
  - 제안: `spec-pending-plan-existence.test.ts` 실제 구현이 `plan/complete/` 경로 허용을 이미 반영하는지 확인 권장.

---

## 요약

이번 변경은 20개 spec Markdown 문서에 대한 사실 동기화 작업으로, 실행 가능한 코드 파일을 단 하나도 수정하지 않는다. 함수 시그니처·전역 변수·환경 변수·파일시스템·네트워크 호출·이벤트/콜백 등 런타임 부작용 요소가 전혀 존재하지 않는다. 부작용 리뷰 관점에서 실질적 위험은 없으며, 유일한 간접 영향은 spec frontmatter `code:` 및 `pending_plans:` 경로 변경이 CI spec 가드 테스트(`spec-code-paths.test.ts`, `spec-pending-plan-existence.test.ts`)에 영향을 줄 수 있다는 점이다 — 이는 코드 부작용이 아니라 선언적 메타데이터 정합성 문제다.

## 위험도

NONE
