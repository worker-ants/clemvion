# Cross-Spec 일관성 검토 — integration-token-ui-autorefresh

검토 모드: `--impl-prep` (구현 착수 전, scope=spec/2-navigation/)
검토 대상: `spec/2-navigation/` 전체 + 변경 의도 (`autoRefresh` 신규 필드 추가)

---

### 발견사항

- **[WARNING]** `autoRefresh` 필드가 spec/2-navigation/4-integration.md 본문에 정의되지 않은 채 구현 착수
  - target 위치: 변경 의도 §1 — `IntegrationDto`에 `autoRefresh: boolean` 추가 및 `ServiceDefinition`에 `supportsTokenAutoRefresh` 옵션 추가
  - 충돌 대상: `spec/2-navigation/4-integration.md` §4.1 Overview 탭, §4.2 Security 탭, §9.1 목록 API 응답 스키마
  - 상세: `spec/2-navigation/4-integration.md` §4.1 의 Overview 탭 "기본 정보" 행 목록 및 §9.1 API 응답 body 에 `autoRefresh` 필드가 존재하지 않는다. 구현에서 `IntegrationDto.autoRefresh` 를 추가하면 API 응답 shape 이 spec 기술과 달라져 API 계약 충돌이 발생한다. 또한 `ServiceDefinition.supportsTokenAutoRefresh` 도 spec 에 대응 항목이 없어 implementation-only 필드가 된다.
  - 제안: 구현 착수 전에 `project-planner` 를 통해 `spec/2-navigation/4-integration.md` §4.1 / §9.1 에 `autoRefresh` 필드 정의와 `supportsTokenAutoRefresh` 서비스 옵션을 명시한 후 구현을 진행한다. 또는 `spec-update-integration-autorefresh.md` plan 이 완료된 뒤 이 PR 을 착수한다.

- **[WARNING]** `computeStatus` 분기 변경이 §2.2 상태 아이콘 / §2.4 배너 술어와 부분 불일치 가능성
  - target 위치: 변경 의도 §2 — `computeStatus`에서 `expiresSoon && !autoRefresh` 로 좁힘
  - 충돌 대상: `spec/2-navigation/4-integration.md` §2.2 항목 요소(상태 아이콘 `🟡 expiring(7일 이내)·expired`), §2.4 "Need attention" 배너 포함 조건
  - 상세: §2.2 에서 `🟡 expiring(7일 이내)` 상태 아이콘은 `autoRefresh` 여부에 대한 예외를 두지 않는다. 구현에서 autoRefresh 통합은 `expiresSoon` 분기를 비활성화해 "Connected" 로 표시하지만, spec 본문은 이 예외를 기술하지 않았으므로 spec과 구현이 어긋난다. 마찬가지로 §2.4 "Need attention" 배너의 포함 조건(`token_expires_at <= NOW() + INTERVAL '7d'`)도 autoRefresh 예외를 갖지 않으며, 변경 의도 §범위 밖에서도 이 문제를 인식하고 있으나(spec 본문 변경 필요) 구현이 먼저 진행되면 UI와 배너 사이에 불일치가 발생한다.
  - 제안: spec/2-navigation/4-integration.md §2.2 와 §2.4 에 `autoRefresh=true` 통합의 상태 표시 예외 규칙을 명시한 후 구현을 진행한다. 현재 plan(`spec-update-integration-autorefresh.md`)이 완료될 때까지 이 PR 을 블로킹하거나, 최소한 spec 변경과 구현 PR 을 동일 세션에서 직렬화한다.

- **[WARNING]** `spec/1-data-model.md` §2.10 `Integration` 엔티티에 `autoRefresh` 관련 필드 없음
  - target 위치: 변경 의도 §1 — `ServiceDefinition.supportsTokenAutoRefresh` 를 `IntegrationsService.toPublic` 에서 매핑
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration 엔티티 필드 목록
  - 상세: `autoRefresh` 는 DB 컬럼이 아니라 서비스 정의(`ServiceDefinition`)에서 계산되는 derived 속성이다. 이 사실이 데이터 모델 spec 어디에도 명시되지 않아, 추후 다른 개발자가 `integration` 테이블에 실제 컬럼을 추가하려 할 가능성이 있다. 또한 `spec/1-data-model.md` 와 `spec/2-navigation/4-integration.md` 사이의 DTO-엔티티 매핑 문서가 없으면 derived 필드의 출처가 불명확해진다.
  - 제안: `spec/2-navigation/4-integration.md` 의 API 응답 스키마 또는 Rationale 섹션에 `autoRefresh` 가 `ServiceDefinition.supportsTokenAutoRefresh` 에서 파생되며 DB 컬럼이 아님을 명시한다.

- **[INFO]** i18n 키 parity 컨벤션 준수 여부 확인 필요
  - target 위치: 변경 의도 §4 — `integrations.tokenAutoRenews`, `integrations.tokenExpiresInAuto` 등 키 추가
  - 충돌 대상: `spec/conventions/` (Swagger·i18n 규약이 별도 파일로 있다면) 또는 기존 i18n 키 네임스페이스 패턴
  - 상세: 기존 `spec/2-navigation/4-integration.md` 내 i18n 키 참조(`history.rerun.permissionDenied` 등 — §3.7에서 다른 spec 참조 시 i18n 키를 직접 기재함)와 일관성을 맞춰야 한다. `integrations.tokenAutoRenews` 와 같이 네임스페이스를 정하는 규칙이 spec 에 명시되어 있지 않으면 개발자마다 키 패턴이 달라질 수 있다.
  - 제안: `spec/conventions/` 에 i18n 키 네이밍 규약이 존재한다면 그에 따르고, 없다면 기존 코드에서 검증 후 일관된 패턴을 사용한다. spec 본문 변경 사항은 아니지만 리뷰 시 ko/en parity 를 명시적으로 체크한다.

- **[INFO]** `spec/2-navigation/4-integration.md` §4.2 Reauthorize 조건 표와 `autoRefresh` 의 관계 미명시
  - target 위치: 변경 의도 §3 — 상세 페이지 Overview 탭 "Token Expires" 행을 autoRefresh 한정으로 친화 표기
  - 충돌 대상: `spec/2-navigation/4-integration.md` §4.2 Overview 탭 Quick actions — `Reauthorize` 비활성 조건 목록
  - 상세: §4.2 의 Reauthorize 비활성 조건은 `pending_install`, `expired AND status_reason='install_timeout'`, `cafe24 private` 케이스만 기술한다. autoRefresh=true 인 통합(cafe24/google)에서 토큰이 임박해도 자동 갱신되는 경우 사용자가 Reauthorize 버튼을 클릭할 필요가 없다는 UX 가이드가 없다. 이는 직접 모순은 아니지만 사용자에게 혼선을 줄 수 있다.
  - 제안: spec 업데이트 plan (`spec-update-integration-autorefresh.md`) 에서 §4.2 Reauthorize 행에 "autoRefresh=true 통합은 정상 자동 갱신 중인 경우 Reauthorize 불필요" 안내 텍스트 추가를 포함한다.

- **[INFO]** `spec/2-navigation/4-integration.md` §11.4 사이드바 배지 카운트와 `autoRefresh` 연동 미확인
  - target 위치: 변경 의도 §범위 밖 — §11.4 사이드바 카운트, §2.3 Expiring 칩은 후속 PR 로 분리
  - 충돌 대상: `spec/2-navigation/4-integration.md` §11.4 사이드바 배지 카운트 쿼리
  - 상세: 이번 PR 에서 `computeStatus`를 autoRefresh 조건으로 좁히면 목록 UI 에서는 expiring 아이콘이 사라지지만, 사이드바 배지 카운트(`§11.4`)는 백엔드 쿼리 기반으로 별도 동작한다. 이 PR 이 먼저 배포되면 UI 목록에서는 expiring이 안 보이는데 사이드바 배지에는 숫자가 남아 UX 불일치가 발생할 수 있다.
  - 제안: 이 불일치가 일시적(후속 PR 전)으로 허용 가능한지 명확히 결정하고, plan 에 "§11.4 카운트 후속 PR 배포 전 일시적 불일치 허용" 을 기재해 tracking 한다.

---

### 요약

target 영역(`spec/2-navigation/`)에서의 구현 착수 전 Cross-Spec 일관성 검토 결과, CRITICAL 수준의 직접 모순은 발견되지 않았다. 그러나 이번 PR 의 핵심 변경인 `autoRefresh` 필드가 `spec/2-navigation/4-integration.md` 의 API 응답 스키마(§9.1), 상태 표시 규칙(§2.2), "Need attention" 배너 술어(§2.4) 어디에도 아직 정의되지 않아 구현이 spec 보다 앞서는 상태다. 또한 `spec/1-data-model.md` §2.10 Integration 엔티티와의 정합성(derived 필드 출처 미명시) 및 사이드바 배지 카운트(§11.4)와의 일시적 불일치도 잠재 충돌로 식별된다. 두 개의 WARNING 항목은 spec 변경 plan(`spec-update-integration-autorefresh.md`)이 완료되기 전 구현을 착수할 경우 spec-implementation 乖離(괴리)가 발생할 수 있음을 의미한다. 구현 착수 전 `project-planner` 를 통해 spec 본문을 먼저 갱신하거나, plan 직렬화를 명시적으로 기록하는 것을 권장한다.

### 위험도

MEDIUM
