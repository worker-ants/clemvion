# 테스트(Testing) 리뷰 — patch-body-followups

## 발견사항

- **[WARNING]** `omitUndefined` 헬퍼에 새로 문서화한 런타임 위험(인자 **자체**가 `null` 이면 `Object.entries` 가 던진다)이 핀 테스트로 고정되지 않았다
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:20-23` (신규 JSDoc) / `codebase/backend/src/common/utils/omit-undefined.spec.ts` (이 diff 에 없음 — 대응 테스트 미추가)
  - 상세: JSDoc 은 "중첩 DTO 필드처럼 필드 전체가 null 일 수 있는 호출부는 먼저 `!= null` 로 가드하라(워크플로 `settings: null` 이 그렇게 500 이 됐었다)" 라고 과거 사고를 근거로 경고를 추가했다. 그런데 이 경고가 서술하는 동작(`omitUndefined(null)` 이 던진다) 자체는 `omit-undefined.spec.ts` 어디에도 핀돼 있지 않다 — 기존 spec 은 falsy 값 보존·얕은 복사·중첩 무시·클래스 필드·빈 객체·배열 타입가드만 덮는다. 현재 호출부(`auth-configs.service.ts:247` `omitUndefined(rest)`, `nodes.service.ts:78` `omitUndefined(dto)`, `workflows.service.ts:249` `omitUndefined(rest)`)는 모두 구조분해된 객체를 넘기므로 즉시 터지지 않지만, `workflows.service.ts:257` 의 `settings != null` 가드처럼 "필드 전체가 null 일 수 있는" 새 호출부가 추가될 때 이 가드를 빠뜨리는 회귀를 잡아줄 단위 테스트가 이 유틸리티 자신에게는 없다. 프로젝트 관례("설계 근거는 실측/테스트로 반증 가능해야 한다")에 비춰 문서만 있고 고정하는 테스트가 없는 상태다.
  - 제안: `omit-undefined.spec.ts` 에 `expect(() => omitUndefined(null as never)).toThrow()` 류의 캐너리 한 줄을 추가해 JSDoc 이 서술하는 계약을 테스트로도 고정한다.

- **[INFO]** CHANGELOG 가 새로 내세운 "`ipWhitelist` 는 `null` 과 빈 배열(`[]`)이 같은 뜻이다" 라는 동치 주장이 enforcement 레벨에서 직접 테스트되지 않는다
  - 위치: `CHANGELOG.md:30` / `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` (`ip_whitelist:` describe 블록, 약 666-800행 부근 — 이 diff 로 추가되지 않음)
  - 상세: `AuthConfigsService.verifyWebhookRequest` 의 화이트리스트 체크는 `ac.ipWhitelist?.length`(옵셔널 체이닝)로 `null` 과 `[]` 를 동일하게 취급하므로 코드상 주장은 사실이다. 그런데 기존 `ip_whitelist:` 테스트 그룹은 `ipWhitelist: ['10.0.0.1']`·`['10.0.0.0/8']` 등 비어있지 않은 값만 시드하고, `ipWhitelist: null`(또는 `[]`)로 시드해 "화이트리스트 없음 → 모든 IP 통과"를 검증하는 케이스가 없다. 이번 PR 은 `null` 이 저장/응답 레벨에서 값을 지운다는 것만 새로 캐너리로 고정했고(서비스 spec 신규 테스트), CHANGELOG 가 명시한 "동작 동치성" 자체는 여전히 미검증 주장이다.
  - 제안: 필수 차단 사유는 아니지만, `verifyWebhookRequest` 쪽에 `ipWhitelist: null` 로 시드한 뒤 임의 IP 가 통과하는 캐너리를 하나 추가하면 CHANGELOG 문구가 실측 근거를 갖게 된다.

- **[INFO]** e2e 테스트 E가 워크플로·노드·인증설정 세 자원의 독립적인 null-clear 동작을 한 `it()` 블록에 몰아넣었다
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts:254` (`it('E. nullable 필드에 null 을 보내면...')`)
  - 상세: 파일의 기존 관례(A~D 도 자원별로 여러 `expect` 를 한 테스트에 묶는 패턴)와 일관돼 있어 스타일 위반은 아니지만, 세 자원 중 앞쪽(워크플로)에서 실패하면 뒤쪽(노드·인증설정) 어서션은 그 실행에서 전혀 도달하지 못해 한 번에 하나씩만 드러난다. 세 필드는 서로 다른 DTO·서비스·컬럼(nullable string vs nullable array)이라 회귀 진단 시 분리된 테스트였다면 실패 지점을 더 빨리 좁힐 수 있었다.
  - 제안: 선택 사항 — 굳이 나누지 않아도 되지만, 향후 이 패턴에 필드를 추가할 때는 자원별 서브테스트(`it.each` 또는 별도 `it`)로 쪼개는 것을 고려.

## 커버리지 관찰 (양호)

- DTO 데코레이터·타입을 **함께** 되돌리는 회귀(원래의 과소 광고 상태)를 기존 `swagger-dto-contract.spec.ts` 가드가 못 잡는다는 것을 뮤턴트(D4~D6)로 먼저 실측하고, 그 빈틈을 정확히 메우는 선언 캐너리(`검증기가 null 을 통과시킨다` + `OpenAPI 가 nullable 로 광고한다`)를 세 DTO 모두에 대칭적으로 추가했다 — 가설을 뮤턴트로 검증한 뒤 테스트를 설계하는 순서가 바르다.
- 서비스 레벨 "명시적 null 은 로드한 값을 지운다" 단위 테스트를 노드·인증설정에 신규 추가해 워크플로와 대칭을 맞췄고(H1 뮤턴트로 필터 회귀도 검증), nodes.service.spec.ts 의 새 테스트는 `label` 미변경 시 `findOne` 이 한 번만 호출되는 실제 서비스 분기와 정확히 일치하는 mock 시퀀스(`mockResolvedValueOnce`)를 쓴다 — mock이 실제 쿼리 패턴과 어긋나지 않는다.
- e2e 테스트 E는 각 필드를 null 이 아닌 초기값(`'before'`, `'memo'`, `['10.0.0.1']`)으로 세팅한 뒙 지우는 방식이라 "원래 null이라 통과한 것처럼 보이는" vacuous 형태를 피했고, 응답 값 → GET 재조회 값까지 함께 단언해 거짓 null/키 누락 회귀를 이중으로 잡는다.
- `contractForDto` 헬퍼는 DTO별 캐시를 쓰지만 jest 가 spec 파일마다 모듈 레지스트리를 격리하므로 파일 간 테스트 오염 소지는 없다.
- CHANGELOG·plan(`patch-body-followups.md`)이 뮤턴트 예측/실측 표를 남겨, "캐너리가 없으면 회귀가 살아남는다" 는 주장을 실측으로 뒷받침한 점이 이 PR 의 테스트 방법론상 강점이다.

## 요약

이번 변경은 세 요청 DTO(`UpdateWorkflowDto.description`·`UpdateNodeDto.description`·`UpdateAuthConfigDto.ipWhitelist`)의 nullable 선언을 실제 런타임 동작에 맞추는 문서·타입 수정이며, 테스트 설계가 전반적으로 매우 꼼꼼하다 — 기존 swagger 가드의 사각지대(데코레이터·타입을 함께 되돌리는 회귀)를 뮤턴트로 먼저 실측하고 그 빈틈을 정확히 메우는 선언 캐너리를 대칭적으로 추가했으며, 서비스 단위 테스트와 e2e 가 저장값·응답값·재조회값을 모두 고정한다. Mock 사용은 실제 서비스의 쿼리/병합 분기와 정확히 일치한다. 다만 이번 diff 로 `omit-undefined.ts` 에 추가한 "인자 자체가 null 이면 던진다" JSDoc 경고가 그 유틸리티 자신의 spec 에서 테스트로 고정되지 않은 점(WARNING)과, CHANGELOG 가 새로 명시한 "null과 빈 배열의 동치" 주장이 enforcement 레벨에서 미검증인 점(INFO)은 이 PR 의 다른 부분이 보여준 "주장은 테스트로 고정한다"는 원칙에서 벗어난 두 자리다. 둘 다 현재 호출부를 깨뜨리지는 않으므로 병합을 막을 사유는 아니다.

## 위험도

LOW
