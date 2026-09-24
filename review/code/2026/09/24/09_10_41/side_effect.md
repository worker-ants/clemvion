# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** DELETE 문에 `role: Not('owner')` 술어 추가 — 엔드포인트 관측 동작 변경(의도된 수정)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:857` (`memberRepository.delete({...})`)
  - 상세: `DELETE /api/workspaces/:id/members/:memberId` 가 "제거 도중 대상이 owner 로 승격되는" 경합 상황에서 이전엔 200(삭제 성공)을 반환했으나 이제는 403 `CANNOT_REMOVE_OWNER` 를 반환한다. 이는 이 PR 의 목적 자체(TOCTOU 버그 수정)이므로 부작용이 아니라 의도된 인터페이스 동작 변경이지만, 이 엔드포인트를 호출하는 외부 클라이언트가 "삭제됐다고 믿었던" 특정 극단 경로의 응답 코드가 바뀐다는 점은 API 계약 변경으로서 기록해 둘 가치가 있다. e2e(`member-remove-concurrency.e2e-spec.ts`)와 unit(`workspaces.service.spec.ts`)에서 고치기 전/후 값(200→403)을 모두 실측했다.
  - 제안: 별도 조치 불필요 — CHANGELOG 에 이미 기재됨. 참고 사항으로만 기록.

- **[INFO]** `affected === 0` 경로에 추가 DB 왕복(`findOne` 재조회) 도입
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:863` (`this.memberRepository.findOne(...)`, `if (affected === 0) { ... }` 블록)
  - 상세: 기존에는 `affected === 0` 이면 즉시 `throwMemberNotFound()` 로 끝났으나, 이제 0-행 사유(이미 삭제됨 vs owner 였음)를 가르기 위해 잠금 없는 재조회를 한 번 더 수행한다. 이는 실패(동시 경합) 경로에만 영향을 주는 의도된 트레이드오프이며 정상 삭제 경로(가장 흔한 경우)에는 추가 왕복이 없다. 부작용이라기보다 설계상 필요한 추가 쿼리이지만, "DELETE 실패 시 추가 SELECT 발생"이라는 관측 가능한 동작 변화이므로 기록한다.
  - 제안: 없음 — 문서화·테스트 모두 갖춰짐.

- **[INFO]** 테스트 헬퍼 `VACUITY_GUARD_MS` 가 비-export 상수에서 export 상수로 승격 — 공개 표면 확장
  - 위치: `codebase/backend/test/helpers/concurrency.ts:31`
  - 상세: 모듈 내부 전용이던 상수가 이제 다른 e2e 파일(`integration-rotate-concurrency.e2e-spec.ts:9`, `member-remove-concurrency.e2e-spec.ts:11`)에서 import 해 재사용한다. 값 자체(1500)는 변경되지 않았고 테스트 전용 헬퍼라 프로덕션 런타임에 영향은 없다. 다만 이 상수가 `assertGuardBelowKnownTimeouts` 의 중앙 검사 범위 밖에서 개별 호출부에 흩어져 쓰이는 기존 설계 한계(주석에 명시된 W5)가 export 로 인해 재사용처가 하나 더 늘었다는 점만 부기한다 — 이미 plan(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 세 번째 자리가 생기면 헬퍼로 뽑겠다는 후속 항목이 등재되어 있어 별도 조치는 불필요.
  - 제안: 없음 — 추적 항목 존재 확인.

- **[INFO]** 브랜치 diff 에 `codebase/frontend/package.json`·`codebase/channel-web-chat/package.json`·`pnpm-lock.yaml` 변경이 나타나지만 이 PR 이 만든 변경이 아님 (오탐 방지용 기록)
  - 위치: N/A — `git diff origin/main --stat` 결과에서만 보임, 이 작업의 커밋 범위 밖
  - 상세: `git diff origin/main` 기준으로 두 `package.json` 의 `next` 버전이 `^16.3.5` → `^16.3.3` 로 "다운그레이드"되고 `pnpm-lock.yaml` 이 394줄 변동된 것처럼 보인다. 그러나 `git log <merge-base>..HEAD -- <해당 파일들>` 로 확인한 결과 이 브랜치의 커밋들은 이 세 파일을 전혀 건드리지 않았다. 실제 원인은 `origin/main` 이 이 브랜치의 fork point(`51c1a89c9`) 이후 `85923ccda build(deps): Bump next from 16.3.4 to 16.3.5 (#1381)` 를 별도로 머지해 앞서 나갔기 때문이며, 이는 브랜치가 뒤처진 것이지 이 리뷰 대상 코드 변경의 부작용이 아니다. 리뷰 프롬프트에 열거된 8개 파일에도 이 세 파일은 포함되어 있지 않다.
  - 제안: 조치 불필요 — 병합/리베이스 시 자연히 해소됨. 통합 조율자가 이 divergence 를 이 PR 의 실책으로 오인하지 않도록 기록만 남긴다.

## 요약

핵심 변경(`workspaces.service.ts` 의 `removeMember` DELETE 술어화 + `throwCannotRemoveOwner` 헬퍼 추출)은 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 어느 축에서도 새로운 부작용을 도입하지 않는다. 시그니처 변경은 모두 하위 호환(테스트 헬퍼 `wireFindOne` 의 신규 옵션 파라미터, `VACUITY_GUARD_MS` export)이거나 private 메서드 내부 리팩터링이다. 유일한 관측 가능한 동작 변화는 의도된 수정 그 자체(경합 상황에서 200→403)와 실패 경로의 추가 SELECT 한 번으로, 둘 다 CHANGELOG·주석·테스트로 충분히 문서화되어 있다. 브랜치 diff 에 나타나는 `next` 버전 divergence 와 `pnpm-lock.yaml` 변동은 이 PR 의 커밋이 만든 것이 아니라 `origin/main` 이 fork 이후 독립적으로 앞서 나간 결과임을 `git log` 로 확인했다 — 이 PR 의 부작용으로 오인되지 않도록 기록해 둔다.

## 위험도

NONE
