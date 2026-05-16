# 문서화(Documentation) Review

리뷰 대상: consistency-checker 산출물 5개 파일 + spec 변경 4개 파일 (총 9개)

---

## 발견사항

### 발견사항 1
- **[CRITICAL]** `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations` — status 허용값과 가상 필터 변환 규칙 전면 삭제로 API 문서 불완전
  - 위치: `spec/2-navigation/4-integration.md` §9.1 API 표, 변경 전 `status` 파라미터 설명 부분
  - 상세: 변경 전 spec 은 `status` 파라미터의 허용값(`connected` / `expiring` / `expired` / `error` / `attention`)과 가상 필터값(`expiring` = `status='connected' AND token_expires_at within 7d`, `attention` = `Expired ∪ Expiring ∪ Error`)의 백엔드 변환 규칙을 명시했다. 이번 변경에서 해당 설명 전체가 삭제되고 "페이지네이션 응답 형식은 API 규약 §5.2 준수" 한 줄만 남았다. `Expiring` 칩은 §2.3에 여전히 존재하므로 프론트엔드가 `?status=expiring` 쿼리를 보내는 상황에서 백엔드 변환 규칙이 spec 어디에도 기술되지 않게 됐다. API 계약의 핵심 동작(가상 필터값 → WHERE 절 변환)이 문서에서 완전히 사라진 상태다.
  - 제안: `expiring` 가상 필터값을 유지하기로 결정하면 §9.1 에 `status` 파라미터 허용값 목록과 변환 규칙을 복원한다. 가상 필터값을 제거하기로 결정하면 §2.3 의 `Expiring` 칩이 어떤 쿼리를 발행하는지를 대신 명시한다. 어느 경우든 API 문서에서 `?status=<value>` 의 허용값이 기술되어야 한다.

### 발견사항 2
- **[CRITICAL]** `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` — `IntegrationDto.appUrl` 필드 제거 시 응답 스키마 문서 부재
  - 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` 행
  - 상세: 변경 전 spec 은 `IntegrationDto`에 `appUrl: string | null` 필드가 포함되며 Cafe24 Private 한정으로 값이 채워지는 규칙, `install_token`이 별도 필드로 노출되지 않는 이유까지 상세히 기술했다. 변경 후에는 "상세 조회 (credentials는 마스킹)" 한 줄만 남아 응답 스키마가 전혀 기술되지 않는다. `appUrl`을 제거하든 유지하든, 응답에 어떤 필드가 포함되는지는 API 문서로서 반드시 명시되어야 한다. 프론트엔드 테스트 코드(`scope-tab.test.tsx`)는 여전히 `appUrl` 필드를 전제로 작성되어 있어 실제 응답 계약과의 불일치가 문서상으로도 추적 불가능한 상태다.
  - 제안: `appUrl` 삭제가 확정이면 `IntegrationDto` 의 응답 필드 목록을 spec 에 명시하고, 제거된 `appUrl` 필드 관련 변경이 Rationale에 기록되어야 한다. `appUrl`을 유지하면 기존 문서를 복원한다. 어느 경우든 §9.1 의 단일 행에 응답 shape 가 기술되지 않은 현 상태는 불완전한 API 문서다.

### 발견사항 3
- **[WARNING]** `spec/2-navigation/4-integration.md` — "Attention 가상 필터값" Rationale 항 전체 삭제로 설계 근거 소실
  - 위치: `spec/2-navigation/4-integration.md` Rationale 섹션, "Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출 (2026-05-16)" 항 전체 삭제
  - 상세: 삭제된 Rationale 항은 (1) `Attention` 칩 신설의 이유, (2) 멀티 선택 칩·multi-value 쿼리를 기각한 근거, (3) 가상 필터값 규약(`Integration.status` DB Enum 비확장 원칙), (4) 배너 톤·점프 동작 보강 배경을 포함하고 있었다. 단일 선택 칩 모델이 왜 세 상태를 동시에 표현할 수 없는지, 그 구조적 제약을 기각된 대안과 함께 설명한 내용이다. 이 Rationale 없이 이번 변경("Attention 칩 삭제, 배너 클릭을 `Expiring|Expired|Error` 로 전환")이 단일 선택 칩 모델과 모순되는지를 후속 작업자가 판단할 수 없게 된다.
  - 제안: `Attention` 칩을 삭제하는 방향이 최종 결정이라면, 해당 Rationale 항을 완전히 지우는 대신 "2026-05-XX 변경 — Attention 칩 삭제, 이유: ..." 형태로 결정 배경을 기록해야 한다. 삭제된 Rationale 은 단일 선택 칩 모델의 제약 분석을 포함하므로, 이를 지우면 동일 논의가 미래에 재발할 가능성이 높다.

### 발견사항 4
- **[WARNING]** `spec/2-navigation/4-integration.md` — "Cafe24 App URL 상세 페이지 표시" Rationale 항 삭제로 에러 복구 흐름 근거 소실
  - 위치: `spec/2-navigation/4-integration.md` Rationale 섹션 말미, "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 항 전체 삭제
  - 상세: 삭제된 Rationale 항은 `renderInstallErrorHtml`의 HMAC 검증 실패 에러 페이지가 사용자에게 "상세 페이지의 App URL 과 비교" 를 안내하는 이유, `install_token` 을 별도 필드로 노출하지 않는 3가지 이유(중복, 식별자 분산, 동기화 부담), HMAC 진단 로그 보강 정책을 포함했다. 이 내용이 삭제됨에 따라 (a) `renderInstallErrorHtml` 의 "상세 페이지에서 App URL 확인" 안내 문구가 왜 존재하는지, (b) 에러 복구 흐름에서 App URL 접근 경로가 왜 필요한지의 근거가 문서에서 사라진다. `spec/4-nodes/4-integration/4-cafe24.md` §9의 에러 복구 안내는 여전히 삭제된 UI 요소(Overview 탭 App URL 카드)를 가리키게 된다.
  - 제안: App URL 카드 삭제가 확정이면 "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 항을 "삭제 결정" 형태의 Rationale 로 전환하고, 대체 접근 경로(또는 제거 이유)를 기록한다. `spec/4-nodes/4-integration/4-cafe24.md` §9 의 에러 복구 안내 문구도 동시에 갱신해야 한다.

### 발견사항 5
- **[WARNING]** `spec/1-data-model.md` §2.10 `install_token` / `install_token_issued_at` — 콜백 성공 시 동작이 변경되었으나 변경 사유가 문서화되지 않음
  - 위치: `spec/1-data-model.md` §2.10 Integration 표, `install_token` 및 `install_token_issued_at` 필드 설명
  - 상세: 변경 전 `install_token` 설명은 "callback 성공 시 보존 — post-install navigation 의 식별 키이며 24h TTL 스캐너는 `pending_install` row 만 대상으로 하므로 `connected` 전이 후의 값이 잘못된 만료 처리에 영향을 주지 않는다" 고 명시했다. 변경 후에는 "callback 성공 또는 TTL 만료 시 NULL" 로 바뀌어 `install_token` 이 callback 성공 시 NULL 처리된다. `install_token_issued_at` 도 마찬가지로 "callback 성공 시 보존" 에서 "callback 성공 시 NULL" 로 반전됐다. 그런데 이 반전에 대한 Rationale(왜 보존에서 NULL 로 바꿨는지, post-install navigation 식별자로서의 역할은 어떻게 되는지)이 spec 어디에도 기술되지 않았다. `spec/2-navigation/4-integration.md` 의 "install_token persistent 격상" 결정은 삭제된 Rationale 에서만 언급되어 있었다.
  - 제안: `install_token` 의 callback 성공 시 처리를 "보존 → NULL" 로 바꾼 이유를 `spec/1-data-model.md` 의 Rationale 또는 `spec/2-navigation/4-integration.md` Rationale 에 기록한다. post-install navigation 식별자 역할이 폐기됐는지 또는 대체 방안이 있는지를 명시해야 한다.

### 발견사항 6
- **[WARNING]** `spec/2-navigation/4-integration.md` §2.4 배너 조건 — 단순화된 표현이 이전보다 주석/설명이 부족
  - 위치: `spec/2-navigation/4-integration.md` §2.4 "Need attention" 배너
  - 상세: 변경 전 배너 포함 조건은 `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'` 형태로 각 조건의 방어 의도(이중 카운트 방지, `pending_install` 제외 등)를 명시했다. 변경 후에는 `token_expires_at <= now() + 7d` 한 줄로 단순화되었다. cross_spec 검토에서 이미 지적된 것처럼 이 단순화는 `expired` 상태 행이 "만료 임박"으로도 집계되는 이중 카운트 가능성을 문서상으로 방어하지 못한다. 이전 조건에 있던 방어 절(`status NOT IN (expired, error, pending_install)`) 제거 이유가 설명되지 않는다.
  - 제안: 단순화된 조건이 의도적이라면 §2.4 에 "왜 방어 조건을 제거했는지" 또는 "이 조건이 `expired` 상태 행에 미치는 영향이 없는 이유"를 인라인 주석으로 추가한다. 의도하지 않은 단순화라면 방어 조건을 복원한다. §11.4 UI 배지 조건도 동일한 단순화가 적용되어 있어 두 곳 모두 일관성 있게 처리되어야 한다.

### 발견사항 7
- **[WARNING]** `spec/data-flow/5-integration.md` §1.2.1 — callback 성공 시 `install_token=NULL` 처리로 변경됐으나 §1.4 텍스트와 불일치
  - 위치: `spec/data-flow/5-integration.md` §1.2.1 다이어그램 내 callback 성공 분기, §1.4 `pending-install-ttl` job 설명
  - 상세: §1.2.1 시퀀스 다이어그램의 callback 성공 분기가 `install_token=NULL` 로 변경됐다. 그런데 §1.4 의 `pending-install-ttl` job 설명은 "재사용 시 `install_token_issued_at` 이 재발급 시점으로 갱신되므로 조기 만료 회귀를 막는다"고 기술하고 있는데, callback 성공 시 `install_token_issued_at` 도 NULL 이 된다면 이 설명의 맥락이 달라진다. 또한 `spec/2-navigation/4-integration.md` Rationale 의 install_token TTL 24h 항도 "callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다" 로 변경되었는데, 이 부분이 `spec/data-flow/5-integration.md` §1.4 의 기존 문구와 충돌하지 않는지 검토가 필요하다.
  - 제안: `spec/data-flow/5-integration.md` §1.4 의 `pending-install-ttl` 설명을 callback 성공 시 NULL 처리 정책과 정합하도록 갱신한다. install_token 이 callback 성공 후 NULL 이 되면 재사용 시나리오(`createPrivatePendingIntegration` 갱신 분기)에서 install_token_issued_at 갱신 로직의 적용 범위가 달라질 수 있으므로 명확히 기술한다.

### 발견사항 8
- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` §9.9 — 섹션 제목·내용이 변경됐으나 CHANGELOG 항목이 해당 변경을 부정확하게 기록
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.9, CHANGELOG 최하단 항목
  - 상세: 변경 전 §9.9 는 "Fields 편집 UI — 메타데이터 기반 typed 동적 폼" 제목으로 Phase 3 의 메타데이터 기반 동적 폼 채택 결정을 기술했다. 변경 후 §9.9 는 "Fields 편집 UI 의 내부 버퍼 분리"로 제목이 바뀌고 내용도 object-shaped contract 한정의 편집 버퍼 패턴으로 재작성됐다. CHANGELOG 의 `2026-05-16 (ux-cleanup)` 항목은 이 변경을 "Phase 3 (PR #88, Cafe24Config 재작성) 가 옛 KeyValueEditor + 편집 버퍼 패턴을 완전히 폐기했으므로 §2 의 편집 버퍼 줄을 제거하고 메타데이터 기반 typed 동적 폼 + 호환 키 보존 동작으로 교체. §9.9 도 (A) 옛 자유 key/value 입력 / (B) 메타데이터 기반 동적 폼 두 안의 비교로 재작성하여 채택안을 (B) 로 명시" 라고 기술하는데, 실제 변경 후 §9.9 는 메타데이터 기반 폼 설명이 아니라 편집 버퍼 패턴(A/B)을 다시 설명하는 내용이다. CHANGELOG 가 실제 spec 본문과 일치하지 않는다.
  - 제안: CHANGELOG `2026-05-16 (ux-cleanup)` 항목을 삭제하거나 실제 변경 내용("§9.9 제목을 '내부 버퍼 분리'로 변경, object-shaped contract 한정 버퍼 패턴 유지 결정으로 재작성")으로 갱신한다. 또한 `2026-05-16 (후속)` 항목은 §2 에 "편집 버퍼" 줄 추가를 언급하는데, 현재 §2 에 편집 버퍼 내용이 남아있어 CHANGELOG 와 본문의 대응 추적이 어렵다.

### 발견사항 9
- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` §2 — "편집 버퍼" 내용이 spec 변경 의도와 불일치하게 남아있음
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI, Fields 항목의 "편집 버퍼" 불릿
  - 상세: diff 에서 §2 의 Fields 항목에 `ExpressionInput`, `enum` / `boolean` / `default` hint, 호환 키 보존 동작 등의 문구가 삭제되고 "편집 버퍼: UI 는 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state 로 관리하고, `onChange` 시 빈 key 행을 제거한 뒤 `Record<string, unknown>` 로 변환해 `config.fields` 에 저장한다" 가 남아있다. 이 "편집 버퍼" 내용은 §9.9 의 "(B, 채택) 내부 편집 버퍼" 와 동일한 설명인데, §9.9 에서는 "object-shaped backend contract 를 가진 통합 노드에 한정"이라 설명한다. 반면 §2 의 Fields 항목은 메타데이터 기반 동적 폼(typed form)을 사용하므로 편집 버퍼 패턴의 적용 대상이 아닌 것처럼 보인다. 본문 §2 가 실제 구현과 대응하는지 명확하지 않다.
  - 제안: §2 의 Fields 불릿이 실제 Cafe24 노드의 현재 구현 방식을 정확히 기술하는지 확인하고, 메타데이터 기반 동적 폼(Phase 3) 환경에서 편집 버퍼 패턴이 여전히 적용되는지를 명시한다. 적용된다면 이유를, 적용되지 않는다면 해당 불릿을 제거한다.

### 발견사항 10
- **[INFO]** `review/consistency/2026/05/16/14_28_20/plan_coherence/review.md` — 섹션 헤더 형식이 다른 리뷰 파일과 불일치
  - 위치: `review/consistency/2026/05/16/14_28_20/plan_coherence/review.md` 전체
  - 상세: 동일 세션의 `cross_spec/review.md`, `naming_collision/review.md`, `rationale_continuity/review.md` 는 `## 발견사항`, `## 요약`, `## 위험도` 형태의 `##` 레벨 헤더를 사용한다. 그런데 `plan_coherence/review.md` 는 `### 발견사항`, `### 요약`, `### 위험도` 형태의 `###` 레벨로 작성되어 있어 동일 세션 내 문서 구조가 불일치한다. 또한 `위험도` 항도 `**HIGH**` 형태가 아니라 `HIGH` 평문으로 작성되어 있다.
  - 제안: `plan_coherence/review.md` 의 헤더 레벨을 `##` 으로 통일하고 위험도 표기도 `**HIGH**` 형식으로 맞춘다. consistency-checker 의 output format 규약이 있다면 해당 규약을 재점검한다.

### 발견사항 11
- **[INFO]** `spec/2-navigation/4-integration.md` §2.4 배너 — 세부 UI 동작(분해 카운트, 톤 강조, 집계 범위)이 삭제된 후 대체 설명 부재
  - 위치: `spec/2-navigation/4-integration.md` §2.4 "Need attention" 배너
  - 상세: 변경 전 §2.4 는 (a) 분해 카운트(`만료 X · 만료 임박 Y · 오류 Z`) 표시 형식, (b) `error ≥ 1` 일 때 dot 색 red 강조, (c) 합계 = 1 일 때 detail 페이지 직접 점프, (d) 집계 범위(현재 페이지 rows 한정)를 기술했다. 변경 후에는 "클릭 시 상태 필터를 `Expiring | Expired | Error` 로 자동 전환", "0건이면 비표시" 두 줄만 남았다. UI 동작의 많은 부분이 삭제되어 구현자가 배너의 클릭 동작, 집계 방식, 시각 강조 정책을 알 수 없다. 이 정보들이 의도적으로 삭제됐는지, 다른 곳으로 이동됐는지 불분명하다.
  - 제안: 배너의 세부 UI 동작(클릭 시 어떤 상태 칩으로 이동하는지, 단일 건일 때 동작, 집계 범위)을 §2.4 에 명시한다. 단일 선택 칩 모델에서 "Expiring | Expired | Error" 를 동시에 활성화하는 UI 표현이 어떻게 구현되는지도 구체적으로 기술되어야 한다(현재 이 부분이 삭제된 Rationale 에서만 "구현 불가" 로 분석되어 있었다).

### 발견사항 12
- **[INFO]** `spec/data-flow/5-integration.md` §1.4 — `cafe24-background-refresh` job 의 `last_rotated_at` 임계가 다이어그램과 텍스트 간 불일치
  - 위치: `spec/data-flow/5-integration.md` §1.4 job 표의 `cafe24-background-refresh` 행 vs 시퀀스 다이어그램
  - 상세: §1.4 의 job 표에서 `cafe24-background-refresh` 의 조건은 `last_rotated_at < now-10d OR last_rotated_at IS NULL` 로 기술되어 있다. 그런데 바로 아래의 시퀀스 다이어그램에서도 동일하게 `last_rotated_at < now-10d OR last_rotated_at IS NULL` 로 일치하나, 텍스트 설명에서 "14일 idle cafe24 통합의 refresh_token 자동 갱신. 임계 근거: refresh_token 14일 - 4일 안전 마진" 이라고 적혀 있다. 10일 임계값과 "14일 - 4일 = 10일" 의 설명은 일치하나, "14일 idle" 이라는 표현이 "10일마다 갱신"과 헷갈릴 수 있다. 이 변경 사항은 이전 코드 리뷰에서 도입된 내용이며 직접적인 문서화 이슈는 아니지만, 임계값의 의미와 안전 마진 계산이 더 명확히 기술될 필요가 있다.
  - 제안: §1.4 의 `cafe24-background-refresh` 설명에서 "14일 idle" 을 "refresh_token 14일 만료 - 4일 안전 마진 = 10일마다 갱신" 으로 명시하여 임계값과 정책의 관계를 독자가 바로 이해할 수 있도록 한다.

---

## 요약

이번 변경은 `Attention` 가상 필터 칩 삭제, `appUrl` 필드 제거, 배너 로직 단순화 등 여러 UX 요소를 축소·제거하는 방향으로 spec을 개정했다. 그러나 문서화 관점에서 두 가지 CRITICAL 문제가 있다. 첫째, `GET /api/integrations`의 `status` 파라미터 허용값과 가상 필터 변환 규칙이 API 문서에서 완전히 삭제되어 `Expiring` 칩이 발행하는 `?status=expiring` 쿼리의 백엔드 처리 방식을 추적할 수 없다. 둘째, `GET /api/integrations/:id` 응답 스키마가 단 한 줄로 대체되어 `appUrl` 제거 여부, `IntegrationDto` 필드 목록 등 API 계약의 핵심 정보가 사라졌다. WARNING 수준에서는 `Attention` 칩 삭제 결정과 `App URL 카드` 제거 결정의 Rationale이 삭제되어 아키텍처 결정의 근거가 소실됐고, `install_token` callback 성공 시 동작이 "보존 → NULL"로 반전됐음에도 변경 사유가 어디에도 기록되지 않았다. `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 항목도 실제 본문 변경과 불일치한다. 전반적으로 기능 삭제와 단순화 과정에서 삭제된 내용에 대한 결정 배경 문서화가 부족하며, API 계약 변경에 대한 문서가 불완전하다.

---

## 위험도

HIGH
