# 요구사항(Requirement) 리뷰 — modelconfig-dup-delete

## 발견사항

- **[INFO]** e2e 테스트 주석의 근거가 실제 구현과 어긋난다 (`remove()`에 default-swap 경로 없음)
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts:57` (게이트 `57|`)
  - 상세: `// \`isDefault: false\` — 기본 설정이면 삭제가 default 스왑 경로를 함께 타므로 판별이 흐려진다.` 라고 적혀 있으나, `ModelConfigService.remove()`(`model-config.service.ts:399-438`)는 `isDefault` 를 전혀 참조하지 않고 `saveWithDefaultSwap`(create/update 전용, `:356-369`)도 호출하지 않는다. DB 레벨에도 delete 시 다른 행의 `is_default` 를 재배정하는 트리거가 없다(`V089__model_config_kind_default_unique.sql` 확인 — partial unique index 뿐, 트리거 없음). 즉 `isDefault:false` 선택 자체는 무해하지만("default 스왑 경로를 함께 탄다"는 진술 자체가 사실이 아님), 주석이 서술하는 인과관계는 이 코드베이스에 존재하지 않는 위험을 서술한다. 형제 e2e 7건(`auth-config-`/`workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-delete-concurrency`·`member-remove-concurrency`) 어디에도 이런 문구가 없어 이 PR 고유의 삽입이다.
  - 제안: 기능적으로 테스트 결과에 영향은 없으므로 차단 사유는 아니다. 다음에 이 파일을 편집할 때 주석을 "고정된 창작 config 를 만들기 위한 선택(대칭적으로 사용하는 create DTO 필드일 뿐, remove() 는 isDefault 를 참조하지 않는다)" 정도로 정정 권장. spec 결함 아님(코드 동작과 무관한 test-only 주석), spec-drift 아님.

- **[INFO]** `mockRepo.remove` mock 정의가 `remove()` 관련 테스트 어디서도 더 이상 참조되지 않음(dead mock)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:35` (게이트 `35|`, `beforeEach` 내부)
  - 상세: `remove: jest.fn().mockResolvedValue(undefined)` 는 여전히 `mockRepo` 객체에 존재하지만, `describe('remove — 동시 삭제')`·`onConfigInvalidated`의 remove 관련 케이스들은 전부 `mockRepo.delete` 를 겨냥하도록 이미 이관됐다(`:364`, `:403`, `:1110`, `:1133`). `mockRepo.remove` 를 단언하는 곳은 파일 전체에 하나도 없다 — 실서비스가 `repo.remove()` 를 더 이상 호출하지 않으므로 이 mock 자체가 죽은 fixture다.
  - 제안: 차단 사유 아님(가짜 통과를 유발하지 않음 — 단순 미사용 mock). 정리 시 제거 검토.

## 점검 관점별 확인 결과 (문제 없음 확인)

- **기능 완전성 / 비즈니스 로직**: `remove()` 를 `repo.remove(entity)` → `repo.delete({id, workspaceId})` + `affected === 0` 명시 비교로 전환. 형제 7건(auth-configs 등)과 동일 패턴(`affected === 0` explicit comparison, workspace 스코프 포함 delete criteria)이며 코드 구조를 직접 diff 비교해 정합 확인함(`auth-configs.service.ts:296-330` 대조).
- **엣지 케이스**: `affected` 가 `undefined`/`null`(드라이버 미보고)인 경우를 0 과 구분해 정상 삭제로 처리 — `it.each([[undefined],[null]])` 대조군 테스트로 커버. **직접 뮤테이션 검증**: `if (affected === 0)` 을 `if (!affected)` 로 바꿔 실행한 결과 이 두 대조군 테스트가 정확히 RED 로 실패함을 실측 확인(plan 체크리스트의 "대조군 2건 RED" 주장과 일치). 검증 후 `cp` 로 원복, `git status --short` 로 잔여물 없음 확인.
- **에러 시나리오**: 진 쪽(`affected===0`)은 `notifyInvalidated`·`recordAudit` 모두 스킵하고 `MODEL_CONFIG_NOT_FOUND`(404) 던짐 — 단위 테스트(`:1105-1121`)로 감사·리스너 모두 미호출 확인.
- **반환값**: `Promise<void>` — 정상/에러 경로 모두 적절 (에러는 throw, 정상은 undefined resolve). 모든 unit 테스트(63개) 로컬 실행 결과 PASS 확인(`npx jest model-config.service.spec.ts` 직접 실행).
- **TODO/FIXME**: 없음.
- **의도와 구현 간 괴리**: 서비스 파일 주석("kind 는 순서 때문이 아니라 조회 결과에서 읽는다")은 실제 구현과 정확히 일치. 테스트 파일의 갱신된 docstring(`'remove 는 조회한 엔티티의 kind 를 감사에 남긴다'`)도 실제 동작과 일치. 위 e2e 주석 1건만 예외(위 INFO 참고).
- **spec fidelity**: 관련 spec은 `spec/2-navigation/6-config.md §Model Config API`(DELETE 엔드포인트, 204 성공), `spec/5-system/3-error-handling.md`(`MODEL_CONFIG_NOT_FOUND`=404, ModelConfig 특화 코드로 명시), `spec/data-flow/1-audit.md`(`model_config.delete` 액션 카탈로그). 셋 모두 구현과 line-level로 정합 — 컨트롤러의 `@HttpCode(HttpStatus.NO_CONTENT)`(204), `this.notFound()` 의 `MODEL_CONFIG_NOT_FOUND`, `AUDIT_ACTIONS.MODEL_CONFIG_DELETE` = `'model_config.delete'` 모두 대조 확인. spec 본문에 "동시 삭제 시 감사 1건만" 같은 명시적 규정은 없으나(회색지대, 기존 형제 7건과 동일 상황), 이는 이미 동봉된 consistency-check(`review/consistency/2026/09/21/16_16_35/SUMMARY.md`)의 INFO 1(패턴이 spec/conventions/ 미문서화)로 이미 식별·유예되어 있어 본 리뷰에서 별도 재기재하지 않음.
- **데이터 유효성**: `id` 는 컨트롤러의 `ParseUUIDPipe` 로 사전 검증(기존 동작 유지, 이 diff의 변경 범위 아님). `workspaceId` 스코프가 `delete` criteria 에 포함돼 cross-workspace 삭제를 차단함을 확인.

## 요약

`ModelConfigService.remove()` 의 무락 삭제 후 이중 감사 로그 결함을, 형제 7건(#1369~#1374)과 동일한 "원자적 DELETE + `affected===0` 명시 비교" 패턴으로 정확히 수정했다. 진 쪽은 `MODEL_CONFIG_NOT_FOUND`(404, 이 모듈 고유 코드 — 형제들의 `RESOURCE_NOT_FOUND` 와 다름)를 받고 감사·캐시 무효화 통지 모두 스킵하며, 이 계약을 단위 테스트(대조군 포함)와 e2e(행 락 기반 동시성 재현 + 공허성 가드)가 각각 고정한다. 뮤테이션(`affected === 0` → `!affected`) 을 직접 재현해 대조군 2건이 예측대로 RED 가 됨을 실측 확인했고, 전체 unit 테스트(63개) PASS 도 재확인했다. 관련 spec 3곳(6-config.md, 3-error-handling.md, data-flow/1-audit.md) 과 함수 시그니처·에러 코드·감사 액션명이 line-level 로 일치한다. 발견된 문제는 e2e 테스트의 부수 설명 주석 1건이 구현에 존재하지 않는 "default 스왑 경로" 를 근거로 든 것(기능 영향 없음, INFO)과, `remove()` 전환 후 참조되지 않는 죽은 mock 필드 1건(INFO) 뿐이며 둘 다 차단 사유가 아니다.

## 위험도
NONE
