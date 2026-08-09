# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** `assertAllUnique(ALL_WS)` 배선 검증 테스트는 소스 텍스트를 정규식으로 스캔하는 방식이라 형식 변화(줄바꿈·주석 삽입 등)에 브리틀하다.
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:52` (`/^\s*assertAllUnique\(ALL_WS\);/` 필터)
  - 상세: 테스트 자체 주석(42~45줄)이 이 트레이드오프를 명시하고 있고("값 검증이 아니라 배선 검증이라 이 형태가 맞다"), 뮤테이션 테스트(U2: 호출 줄 삭제 → RED)로 이 형태가 로드베어링임을 실증했다(커밋 `1f71f618c`). 실제로 `npx jest workspace-id-fixtures.spec.ts` 6/6 PASS 로 재확인했다. 결함이 아니라 의도된 설계 트레이드오프.
  - 제안: 조치 불필요. 향후 소스 포맷터가 세미콜론 생략 스타일 등으로 바뀌면 이 테스트만 별도로 깨질 수 있다는 점만 인지.

- **[INFO]** spec fidelity: 이번 변경 영역(`common/__test-utils__/workspace-id-fixtures.{ts,spec.ts}`, `common/utils/uuid.spec.ts` 주석)은 `spec/5-system/1-auth.md` frontmatter `code:` 글로브에 `common/utils/uuid.ts`(프로덕션 파일)만 포함되고 `__test-utils__/**` 는 포함되지 않는다. 테스트 인프라·주석 통합이라 애초에 spec 본문이 규율하는 대상(행위 명세·필드 정의)이 아니며, `uuid.ts`(spec-linked)의 실제 함수 로직(`isUuidShaped`/`isValidUuid`)은 이번 diff 에서 변경되지 않았다(docstring 은 이전 PR `#1112`에서 이미 SoT로 확정된 상태를 그대로 참조만 함).
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (변경 없음, 참조 대상), spec: `spec/5-system/1-auth.md` frontmatter
  - 상세: 관련 spec 본문(§3.3, Rationale)은 이미 별도 planner 턴(`spec-draft-auth-invariants-sync.md`, 완료)에서 `isUuidShaped` 채택 근거·`VALIDATION_ERROR` 매핑을 반영했다고 plan 이 기록하고 있다. 이번 diff 는 그 spec 과 어긋나는 동작 변경이 없다 — 코드 로직 불변, 주석 중복 제거만.
  - 제안: 조치 불필요 (회색지대, 정보성).

## 검증 내역

- `assertAllUnique` 로직: `Set(values).size === values.length` → 통과, 아니면 `고유 N / 전체 M` 메시지로 throw. 함수명·의도·구현 일치.
- 엣지 케이스: 빈 배열(`size 0 === length 0`)·단일 원소(`1===1`) 모두 정상 통과 — 테스트로 명시 커버(`workspace-id-fixtures.spec.ts:37-40`).
- `ALL_WS` 가 export 된 7개 상수(`HEADER_WS`,`TOKEN_WS`,`VICTIM_WS`,`OTHER_WS`,`DECOY_WS`,`SAME_WS`,`NIL_WS`) 전부를 포함하는지 정렬 비교로 고정 — 새 상수 추가 시 `ALL_WS` 누락을 잡는 회귀 방지 테스트 존재.
- 실측 재현: `npx jest src/common/__test-utils__/workspace-id-fixtures.spec.ts` 6/6 PASS, `npx jest src/common/utils/uuid.spec.ts` 8/8 PASS, 소비 스위트 3곳(`workspace.decorator.spec.ts`·`workspace-context.util.spec.ts`·`roles.guard.spec.ts`) 59/59 PASS. `eslint` clean.
- `uuid.spec.ts` 주석 통합 후 남긴 두 문장("이 둘이 유일한 방어선이다" · `roles.guard.spec.ts` 전역 라우트 예외)은 실제로 `uuid.ts` `isUuidShaped` docstring(SoT)에 **없는** 사실이라 남긴 것이 맞다 — grep 으로 프로덕션 호출부가 `workspace-context.util.ts:74` 단 한 곳임을 재확인, plan 의 "전량 삭제가 아니라 선별" 주장과 일치.
- TODO/FIXME/HACK/XXX 주석 없음.
- 반환값: `assertAllUnique` 는 모든 경로에서 적절히 처리(성공 시 암묵적 `void` 반환, 실패 시 throw) — 누락된 경로 없음.
- 데이터 유효성/비즈니스 로직: 값 유일성이라는 비즈니스 규칙(픽스처 간 값이 겹치면 cross-tenant 테스트가 무의미해진다)이 로드 시점 런타임 검사로 정확히 강제됨.
- `plan/in-progress/auth-guard-reflection-hardening.md`: 체크박스 갱신 내용이 실제 코드 변경과 일치(값 유일성 가드 추가·nil-UUID SoT 통합 완료 표시). frontmatter `status: in-progress` 유지가 맞다 — 남은 미체크 2건(메모이제이션·`__test-utils__` exclude)은 조건부 트리거이며 근거가 각각 적혀 있어 stale 체크박스가 아니다.

## 요약

`workspace-id-fixtures` 픽스처 모듈에 값 유일성 가드(`assertAllUnique`)를 순수 함수로 추출하고 로드 시점에 호출하도록 배선했으며, 그 판정 로직과 배선 자체를 겨누는 전용 spec(`workspace-id-fixtures.spec.ts`)을 신설했다. nil-UUID 관련 근거·회귀 캐너리 서술은 `uuid.ts`의 `isUuidShaped` docstring 을 SoT 로 삼아 `uuid.spec.ts`·`workspace-id-fixtures.ts` 양쪽에서 포인터로 축약했고, SoT 에 없는 사실 2건은 선별적으로 보존했다. 실제 파일을 열어 함수 로직·엣지 케이스·소비 스위트 배선을 대조하고 관련 jest 스위트 6종을 재실행해 전부 GREEN, eslint clean 을 확인했다. 프로덕션 동작(`isUuidShaped`/`isValidUuid`)은 변경되지 않았고 spec-linked 파일(`uuid.ts`)의 로직도 불변이라 spec 본문과의 line-level 불일치나 SPEC-DRIFT 는 발견되지 않았다. Critical/Warning 없음 — INFO 2건은 조치 불요한 정보성 관찰이다.

## 위험도
NONE
