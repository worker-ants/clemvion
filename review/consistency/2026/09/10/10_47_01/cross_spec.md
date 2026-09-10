# Cross-Spec 일관성 검토 — `spec-draft-integration-dto-pointer.md`

## 검토 대상
- target: `plan/in-progress/spec-draft-integration-dto-pointer.md` (draft, `spec_impact: spec/2-navigation/4-integration.md`)
- 실제 변경 지점: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` 행
- 교차 참조: `spec/1-data-model.md §2.10 Integration`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`

## 사실관계 확인 (adopt 전 재검증)

- `origin/main`(`5873b9678`) 기준 `integration-response.dto.ts` 145~167행에 `mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures` 5필드가 실제로 선언돼 있음을 확인 — target 의 표(§착수 전 재판정)와 일치.
- `spec/1-data-model.md §2.10`(1750줄 파일 아님, `1-data-model.md` 자체) 엔티티 표에 5필드 전부 존재 — `mall_id`(453행), `token_expires_at`(456행), `last_used_at`(457행), `last_rotated_at`(458행), `consecutive_network_failures`(455행). target 의 "5/5" 주장 확인.
- DTO 소스 159~164행 JSDoc이 target 이 §9.1 에 넣으려는 캐비엇("프런트엔드 참조 0곳", "제거는 breaking, 별도 트래커")과 문장 수준으로 이미 동일함 — 새로 넣을 텍스트가 기존 코드 주석과 모순되지 않음.
- `spec/2-navigation/4-integration.md` §13 "데이터 모델 영향 요약"이 이미 `last_used_at`/`last_rotated_at`/`mall_id`/`status_reason`/`last_error` 를 "데이터 모델 §2.10" 소관으로 명시 — target 의 포인터 방향과 기존 문서 내부 관행이 일치.
- `#210-integration` 앵커는 `4-integration.md`·`4-nodes/4-integration/0-common.md`·`5-system/11-mcp-client.md`·`conventions/cafe24-restricted-scopes.md` 등 5곳 이상에서 이미 사용 중인 확립된 앵커 — 신규 앵커가 아니라 문서 가드가 이미 통과시키고 있는 형태. 앵커 실재 리스크 없음.
- `IntegrationDto` 를 언급하는 spec 문서는 `2-navigation/4-integration.md` 뿐 — 다른 영역(`data-flow/5-integration.md`, `4-nodes/4-integration/*.md`, `5-system/11-mcp-client.md`)에 이 DTO 의 필드 인벤토리를 별도로 주장하는 문장 없음. 데이터 모델 충돌·API 계약 충돌 없음.
- `consecutiveNetworkFailures` FE 미참조 주장은 `spec/` 안에서 이 컬럼을 언급하는 다른 3곳(`4-integration.md:629`, `:720`, `data-flow/5-integration.md:390`) 모두 **백엔드 상태-전이 판정** 문맥이고 FE DTO 소비 문맥이 아님 — target 의 "FE 참조 0곳" 주장과 상충하지 않음(컬럼 자체가 서버 로직에 쓰이는 것과 DTO 필드로서 FE 가 읽는 것은 별개 주장이며 target 은 후자만 말한다).

## 발견사항

- **[WARNING]** 삽입 문구의 "전이 규칙 SoT = §2.10" 일반화가 실제 SoT 배치와 어긋남
  - target 위치: 변경안 삽입 텍스트 — "그 컬럼들의 **의미·전이 규칙·마이그레이션**은 [데이터 모델 §2.10](../1-data-model.md#210-integration) 이 SoT 이며 여기 복제하지 않는다"
  - 충돌 대상: `spec/2-navigation/4-integration.md §6 상태 전이`(720행 `connected → error(network)`), `§11.1 스캐너 잡`(`connected-expiry` job의 `token_expires_at` 임계 판정, `cafe24-background-refresh` job의 `last_rotated_at < now-7d` 조건) — **같은 문서, §9.1 이 편집되는 바로 그 파일**
  - 상세: 5필드 중 `tokenExpiresAt`(만료 스캐너 판정 기준, §11.1)과 `lastRotatedAt`(background-refresh 임계 조건, §11.1 Rationale)의 실제 "전이/사용 규칙" 은 `1-data-model.md §2.10` 에 없고 `2-navigation/4-integration.md` 자신의 §6·§11 이 소유한다. `consecutiveNetworkFailures` 조차 §2.10 항목 자체가 "spec §6 `connected → error(network)` 전이의 **구현 기반**"이라고 §6 을 SoT 로 명시 지목하고 있어(§2.10 원문: "spec §6 `connected → error(network)` 전이의 구현 기반"), §2.10 을 "전이 규칙의 SoT" 라고 부르는 것은 §2.10 자신의 자기 서술과도 어긋난다. `lastUsedAt` 은 애초에 어떤 전이 규칙에도 관여하지 않는 단순 캐시 타임스탬프라 "전이 규칙" 서술 대상 자체가 아니다. 결과적으로 5필드에 균일하게 "의미·전이 규칙·마이그레이션 SoT = §2.10" 을 선언하면, 이 캐비엇이 고치려는 원래 결함("§9.1 문장이 인벤토리 주장으로 오독된다")과 같은 종류의 과잉 일반화가 새 문장에도 재현된다 — 다음 독자가 `tokenExpiresAt` 의 전이 규칙을 찾아 §2.10 을 열었다가 빈손으로 돌아와 결국 같은 문서 §6·§11 을 다시 찾아야 한다.
  - 제안: "전이 규칙" 을 블랭킷으로 §2.10 에 귀속시키지 말고 범위를 좁힌다. 예: `"그 컬럼들의 의미·마이그레이션은 §2.10 이 SoT 이며 여기 복제하지 않는다(상태 전이에 관여하는 컬럼(`tokenExpiresAt`·`lastRotatedAt`·`consecutiveNetworkFailures`)의 전이 규칙 자체는 본 문서 §6·§11 이 SoT — §2.10 은 컬럼 메커니즘만 정의)."` 또는 "전이 규칙" 단어를 아예 빼고 "의미·마이그레이션은 §2.10, 전이 규칙은 필드별로 상이(§6/§11 참조)" 로 조정.

## 요약

target 이 실제로 바꾸는 것은 `spec/2-navigation/4-integration.md §9.1` 한 행뿐이며, 검증 결과 5필드의 존재·이름·데이터 모델 위치(§2.10)·DTO 소스 코드·기존 §13 관행·문서 앵커가 모두 target 의 주장과 일치해 API 계약·데이터 모델·요구사항 ID·RBAC·계층 책임 축에서는 새로 발견된 모순이 없다. 유일한 흠은 삽입 문구가 "전이 규칙" 까지 §2.10 의 SoT 로 뭉뚱그린 부분으로, `tokenExpiresAt`·`lastRotatedAt` 의 실제 전이/스캐너 규칙은 편집 대상인 `4-integration.md` 자신의 §6·§11 이 이미 소유하고 있고 §2.10 도 `consecutiveNetworkFailures` 항목에서 §6 을 SoT 로 재지목하고 있어, 이 문구를 그대로 채택하면 "인벤토리 오독을 막으려던 캐비엇"이 "전이 규칙 SoT 오귀속"이라는 축소된 형태의 같은 문제를 새로 만든다. 이는 두 영역(데이터 모델 vs 네비게이션 스펙)이 실제로 나눠 가진 책임 경계와 어긋나는 WARNING 이며, 문구를 한 문장만 좁히면 해소된다.

## 위험도
LOW
