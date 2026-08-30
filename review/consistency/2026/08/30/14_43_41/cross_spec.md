# Cross-Spec 일관성 검토 — `spec/data-flow/` (impl-done)

## 검토 대상 요약

diff-base `origin/main` 대비 변경분은 전부 **backend 테스트 인프라/구조적 가드** 코드다:

- `codebase/backend/src/common/__test-utils__/source-scan.ts` — 순수 함수 `countRawUpdateReturning` / `hasRawUpdateReturning` 신설 (raw `UPDATE`/`DELETE … RETURNING` SQL 리터럴을 첫 키워드 기준으로 탐지)
- `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` — 위 헬퍼의 양성/음성 케이스 고정
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — `src/**` 전수 스캔 기반 "헬퍼 미경유 raw 지점" 발견형 가드(`findUnguarded`) 신설 + 합성 입력 단위 테스트
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` / `.spec.ts` — `dataSource.query<...>` 타입 인자를 `{...}[]` → `[{...}[], number]` 튜플로 정정 (raw UPDATE…RETURNING 의 실제 드라이버 반환 계약과 일치시킴), mock 도 동일 튜플 형태로 정정. **동작 변경 없음** — `refresh()` 는 여전히 반환값을 소비하지 않는다.

target 문서로 지정된 `spec/data-flow/` 폴더(2-auth.md 전문 + 0-overview/1-audit/3-execution/9-observability/11-workflow 등)는 이번 diff 로 **한 글자도 수정되지 않았다** — 코드만 바뀐 impl-done 검토다.

## 발견사항

이번 diff 는 제품 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임 중 어느 것도 정의·변경하지 않는다 (순수 테스트 스캐너 함수 + 타입 정정). Cross-Spec 관점에서 충돌 후보를 아래처럼 좁혀 확인했으나 전부 무충돌로 판정한다.

- **[INFO] RETURNING 패턴의 spec 상 유일한 선례와 일치** — `spec/data-flow/2-auth.md` §1.3/§2.1/§3.3 이 문서화한 `auth_oauth_state` 의 `DELETE … RETURNING *` (원자적 one-shot consume) 이 이번 신규 가드(`countRawUpdateReturning`)의 탐지 대상 형태와 정확히 일치한다. `update-returning-rows.spec.ts` 의 발견형 가드 테스트가 `modules/auth/auth-oauth.service.ts` 를 실제로 찾아내는지 단언하는 것도 이와 부합 — 대상 위치: diff `update-returning-rows.spec.ts` `'발견 자체가 공허하지 않다'` 케이스. 충돌 없음, 오히려 보강.
- **[INFO] `spec/data-flow/2-auth.md` §1.4 의 refresh_token 회전 UPDATE 는 이번 가드의 스캔 대상 밖** — §1.4 본문은 `UPDATE refresh_token SET is_revoked=true … WHERE id=? AND is_revoked=false AND expires_at>now` 뒤 `affected` 카운트만으로 경합을 판정하며 `RETURNING` 절을 쓰지 않는다(§Rationale "회전 원자성" 도 동일 서술). 신규 가드는 `RETURNING` 키워드 유무로 판정하므로 이 지점은 애초에 탐지 대상이 아니고, 이는 spec 서술과 모순되지 않는다(spec 도 RETURNING 을 언급하지 않음).
- **[INFO] `kb-stats.helper.ts` 타입/모의 정정은 `spec/data-flow/6-knowledge-base.md` 본문 미확인** — 해당 spec 파일은 컨텍스트 예산 초과로 이번 프롬프트에 포함되지 않았다. 다만 diff 는 `entity_count`/`relation_count` 필드 정의나 API 응답 계약을 바꾸지 않고, `.query()` 호출의 **타입 인자**(컴파일 타임 주석)와 테스트 mock 형태만 실제 pg 드라이버 반환 계약(`[rows, affectedCount]`)에 맞춘 것이다 — 런타임 동작·반환값 소비 여부 불변. 데이터 모델·API 계약 충돌 소지 없음으로 판단.

## 요약

이번 diff 는 raw `UPDATE`/`DELETE … RETURNING` SQL 패턴을 헬퍼 경유 없이 직접 소비하는 지점이 새로 생기는 것을 막는 **구조적 테스트 가드**(신규 순수 함수 2개 + 전수 스캔 기반 미가드 지점 탐지 테스트)와, 그 계약을 스스로 어길 뻔했던 `kb-stats.helper.ts` 의 **타입 인자/모의 정정**으로 구성된다. 제품 정의·엔티티·API·요구사항 ID·상태 머신·RBAC·계층 책임 중 어느 것도 새로 선언·변경하지 않으므로 `spec/data-flow/**` 는 물론 다른 어떤 spec 영역과도 충돌 표면이 없다. 유일하게 관련된 spec 서술(`2-auth.md` 의 `auth_oauth_state` DELETE…RETURNING, refresh_token 회전 UPDATE)은 모두 이번 가드의 판정 축과 부합하며 모순이 없다. `6-knowledge-base.md` 본문은 컨텍스트 예산으로 미확인이나, diff 자체가 타입 주석 수준 정정이라 데이터 모델 충돌 리스크가 낮다고 판단했다 — 필요시 후속 검토에서 직접 열어 재확인 권장(비차단).

## 위험도

NONE
