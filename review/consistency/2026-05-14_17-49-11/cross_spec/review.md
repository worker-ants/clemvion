관련 spec 파일 분석이 완료됐습니다. Cross-spec 발견사항을 정리합니다.

---

## 발견사항

---

### [WARNING] `spec/2-navigation/4-integration.md` §11.1 만료 스캐너 미갱신

- **target 위치**: 영향 범위 목록 없음 — §11.1 이 "영향받는 연관 문서"에 포함되지 않음
- **충돌 대상**: `spec/2-navigation/4-integration.md` §11.1 (`integration-expiry` 스캐너 잡 설명)
- **상세**: DRAFT 3C-bis 는 `spec/data-flow/integration.md §1.4` 를 갱신해 `pending_install` 24h TTL 스캔 분기를 추가하나, `spec/2-navigation/4-integration.md §11.1` 은 여전히 `대상: Integration WHERE token_expires_at IS NOT NULL` 만 기술된다. 개발자가 §11.1 을 구현 근거로 삼으면 `pending_install` TTL 스캐너 분기를 누락한다. 두 문서가 서로 다른 스캐너 대상을 기술하게 된다.
- **제안**: §11.1 `대상:` 줄에 `AND (pending_install 24h 초과 분기)` 설명을 추가하거나, §11 서두에 "pending_install TTL 처리는 §1.4 참조" forward-ref 를 추가한다.

---

### [WARNING] §10.2 `reauthorize` 분기 설명과 `pending_install` 동작 불일치

- **target 위치**: DRAFT 2G (§10.4 에러 매핑 + §10.2 step 6 추가)
- **충돌 대상**: `spec/2-navigation/4-integration.md` §10.2 step 4 `reauthorize` 분기
- **상세**: 현재 §10.2 step 4 는 `reauthorize: 기존 integrationId 의 credentials 를 새 토큰으로 교체, status 를 connected 로 복귀` 라고 기술한다. 초기 Private 앱 install 흐름도 mode=reauthorize 를 사용하므로 (`DRAFT 3C §1.2.1: OAuthState INSERT … mode=reauthorize`) 이 분기 설명이 적용된다. 그런데 status=`pending_install` 에서 callback 성공 시 "connected 로 복귀(復歸)"가 아닌 첫 연결이며, callback 실패 시에는 `pending_install` 유지(status 보존)가 요구된다. 이 예외 동작은 step 4 에 반영되지 않고 step 6(신규 추가) 과 §10.4 에 분산 기술되어, 구현자가 step 4 만 보면 `pending_install` 실패 시에도 status=connected 로 갱신하는 오류를 범할 수 있다.
- **제안**: §10.2 step 4 `reauthorize` 항에 `※ integrationId 의 기존 status 가 pending_install 인 경우 성공 시 connected, 실패 시 pending_install 유지 — 상세는 step 6` 한 줄을 추가한다.

---

### [WARNING] `spec/data-flow/integration.md` §1.2 부모 다이어그램 기존 불일치 — draft 가 가시성 증가

- **target 위치**: DRAFT 3C (§1.2 forward-ref + §1.2.1 sub-diagram 추가)
- **충돌 대상**: `spec/data-flow/integration.md §1.2` (기존 OAuth 시퀀스 다이어그램)
- **상세**: 기존 §1.2 다이어그램은 `C->>Svc: GET /api/integrations/oauth/:service/start` 를 사용한다. 실제 API 는 `spec/2-navigation/4-integration.md §9.2` 기준 `POST /api/integrations/oauth/begin` 이다. draft 가 올바른 경로를 사용하는 §1.2.1 sub-diagram 을 추가함으로써, 부모 다이어그램의 잘못된 경로가 더 눈에 띄게 된다. 구현자가 혼동할 수 있다.
- **제안**: DRAFT 3C forward-ref 문장과 함께 §1.2 부모 다이어그램의 `GET /oauth/:service/start` 도 `POST /oauth/begin` 으로 정정한다 (draft 적용 범위 내 추가 수정으로 해결 가능).

---

### [INFO] DRAFT 2K 섹션 번호 라벨 오기

- **target 위치**: `DRAFT 2K` 헤더 — "§4.2 Overview 탭 Reauthorize 행"
- **충돌 대상**: `spec/2-navigation/4-integration.md` 실제 구조
- **상세**: diff 의 old_string `| Reauthorize (OAuth) | [Reauthorize] 버튼 → ...` 는 §4.3 Security 탭의 내용이다. §4.2 Overview 탭은 "Quick actions" 요약 행만 가진다. draft 헤더가 §4.2 라고 표기하지만 실제 수정 대상은 §4.3 이다. (Quick actions 행 수정은 §4.2 가 맞음 — §4.2 와 §4.3 두 곳 모두 수정하는 내용이나 섹션 라벨이 §4.2 로만 기술됨)
- **제안**: 헤더를 "§4.2 + §4.3 Reauthorize 행 비활성 조건 추가" 로 수정한다.

---

### [INFO] `credentials_unreadable` 신규 `status_reason` — 연관 섹션 cross-reference 없음

- **target 위치**: DRAFT 1C (`status_reason` 행), DRAFT 3B
- **충돌 대상**: `spec/2-navigation/4-integration.md` §6 상태 전이 표, §10.4 에러 매핑
- **상세**: `credentials_unreadable` 가 error status_reason 후보로 추가되나, §6 상태 전이 트리거 표 및 §10.4 에러 매핑 표에 이 케이스가 명시되지 않는다. 언제(V042 이후 키 회전) 어떤 경로로 이 값이 채워지는지 spec 에서 추적하기 어렵다.
- **제안**: §6 노트 또는 §10.4 에 `credentials_unreadable` 케이스를 한 줄 추가한다.

---

### [INFO] §2.3 필터 칩에 `pending_install` 미추가 — 명시적 주석 없음

- **target 위치**: DRAFT 2I Rationale
- **충돌 대상**: `spec/2-navigation/4-integration.md` §2.3 상태 칩 정의
- **상세**: `pending_install` 을 필터 칩에 추가하지 않는 결정은 Rationale 에만 서술되고 §2.3 본문 상태 칩 목록 (`All / Connected / Expiring / Expired / Error`) 에는 반영되지 않는다. 필터 칩 목록만 보면 `pending_install` 의 필터 여부를 알 수 없다.
- **제안**: §2.3 상태 칩 행에 `pending_install: 필터 칩 미노출 (정상 전환 상태로 간주 — Rationale §2I 참조)` 주석을 추가한다.

---

### [INFO] 기존 용어 불일치 — draft 가 수정 (긍정적)

- **target 위치**: DRAFT 2H (§14.2, `4-cafe24.md:337`, `cafe24-api-metadata.md §6`)
- **상세**: 현재 `spec/2-navigation/4-integration.md §14.2` 와 `spec/4-nodes/4-integration/4-cafe24.md §8.3` 은 "Resource 단위 grouping" 을 사용하나 `spec/conventions/cafe24-api-metadata.md §6` 는 이미 "카테고리 단위 grouping" 을 사용한다. draft 가 이를 통일하고 맥락별 혼용 기준을 명시한다. 기존 불일치를 해소하는 변경이므로 별도 조치 불요.

---

## 요약

draft 는 내부적으로 일관성이 높으며 주요 cross-spec 수정(데이터 모델 · 내비게이션 스펙 · Cafe24 노드 스펙 · data-flow 스펙) 을 포괄한다. Critical 위배는 없다. 가장 위험도가 높은 이슈는 **§11.1 만료 스캐너 미갱신(W1)** 으로, `spec/2-navigation/4-integration.md §11.1` 이 draft 영향 목록에서 누락되어 `pending_install` TTL 스캐너 구현 근거가 data-flow spec 에만 존재하게 된다. **§10.2 step 4 reauthorize 분기 불완전 기술(W2)** 은 `pending_install` 실패 시 status 보존 동작이 step 4 에 명시되지 않아 구현 오류 위험이 있다. 두 이슈 모두 spec 적용 전에 보완을 권장한다.

## 위험도

**LOW** — Critical 위배 없음. WARNING 2건은 구현 혼동 가능성이 있으나 spec 내 다른 섹션(step 6, §10.4, data-flow §1.4)에서 의도가 명확히 기술되어 있어 이중 확인으로 방어 가능. spec write 차단 기준에 해당하지 않음.