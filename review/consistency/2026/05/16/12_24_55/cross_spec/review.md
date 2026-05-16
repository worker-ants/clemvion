# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-data-model-install-token-followup.md`
변경 대상 spec: `spec/1-data-model.md §2.10` (Integration.install_token, Integration.install_token_issued_at)

---

## 발견사항

### [CRITICAL] `spec/1-data-model.md` 의 `install_token` 컬럼 설명이 이미 머지된 정책과 직접 모순

- **target 위치**: `spec/1-data-model.md §2.10` Integration 테이블, `install_token` 필드 설명 (corpus line 687)
- **충돌 대상**:
  - `spec/2-navigation/4-integration.md` Rationale §"install_token TTL 24h (2026-05-15 갱신, 2026-05-16 보강)" — callback 성공 시 install_token 보존 정책 확정
  - `spec/data-flow/integration.md §1.2.1` line 90 — 동일 보존 정책 명시
- **상세**: 현재 `spec/1-data-model.md` corpus(line 687)에 기록된 `install_token` 컬럼 설명은 `"callback 성공 또는 TTL 만료 시 NULL"`이라고 명시한다. 그러나 이미 직전 commit에서 머지된 `spec/2-navigation/4-integration.md`와 `spec/data-flow/integration.md`는 callback 성공 시에도 install_token을 보존(NULL 처리하지 않음)하고, TTL 만료(`pending_install → expired`, 24h) 또는 통합 삭제 시에만 NULL/소거한다는 정책을 확정하고 있다. 두 spec이 동일 컬럼의 NULL 처리 시점에 대해 정반대의 기술을 유지하는 상태이므로, 구현자가 data-model.md를 기준으로 코드를 작성하면 post-install navigation(App URL 흐름에서 install_token을 식별 키로 재사용)이 동작하지 않는다.
- **제안**: target draft가 제안하는 정정(callback 성공 시 보존, TTL 만료/삭제 시에만 NULL)을 `spec/1-data-model.md §2.10`에 즉시 반영한다. 정정 내용은 이미 머지된 두 spec의 정책을 따르므로 신규 정책 도입이 아니며 단순 drift 해소다.

---

### [CRITICAL] `spec/1-data-model.md` 의 `install_token_issued_at` 컬럼 설명이 이미 머지된 정책과 직접 모순

- **target 위치**: `spec/1-data-model.md §2.10` Integration 테이블, `install_token_issued_at` 필드 설명 (corpus line 688)
- **충돌 대상**:
  - `spec/2-navigation/4-integration.md` Rationale §"install_token TTL 24h" — install_token과 install_token_issued_at이 동행(함께 보존/소거)한다는 정책 확정
  - `spec/data-flow/integration.md §1.2.1` line 90 — 동일 동행 정책 명시
- **상세**: 현재 `spec/1-data-model.md` corpus(line 688)에 기록된 `install_token_issued_at` 컬럼 설명은 `"재사용/새 발급 시 갱신, callback 성공 시 NULL"`이라고 명시한다. 이미 머지된 다른 spec들은 `install_token_issued_at`도 `install_token`과 동행하여 callback 성공 시 보존하고, TTL 만료/통합 삭제 경로에서만 NULL 처리함을 확정하고 있다. `install_token_issued_at`은 TTL 스캐너(`pending-install-ttl` job)가 `now - 24h`와 비교해 만료 판단에 사용하는 핵심 컬럼이므로, callback 성공 시 NULL로 소거하면 스캐너가 이후 동일 통합의 새 install 흐름 재시도 시 fallback 경로(`created_at` 기준)로 전락하여 TTL 정확도가 저하된다.
- **제안**: target draft가 제안하는 정정(callback 성공 시 보존, TTL 만료/삭제 경로에서만 NULL)을 `spec/1-data-model.md §2.10`에 즉시 반영한다.

---

### [INFO] `spec/2-navigation/4-integration.md` 및 `spec/data-flow/integration.md`는 보조 코퍼스에 직접 포함되지 않아 독립 검증 불가

- **target 위치**: target draft §정합성 (line 58-60)
- **충돌 대상**: 없음 (검증 범위 한계)
- **상세**: prompt_file의 보조 코퍼스에는 `spec/2-navigation/4-integration.md`와 `spec/data-flow/integration.md`의 전문이 포함되지 않았다. target draft가 "직전 commit에서 머지됨"으로 주장하는 두 spec의 실제 본문을 본 검토에서 직접 확인하지 못했다. 따라서 draft가 주장하는 "완전 일치" 여부는 해당 파일의 현행 본문을 직접 조회하여 재확인할 것을 권장한다. 단, prompt_file 내 `spec/1-data-model.md`의 Rationale 섹션(line 1102-1104)과 Integration 테이블의 cross-reference 문구들이 두 spec의 정책을 일관되게 인용하고 있으므로, 실질적 모순 가능성은 낮다.
- **제안**: 구현 착수 전 `spec/2-navigation/4-integration.md §6 상태 전이`와 `spec/data-flow/integration.md §1.2.1`의 현행 본문을 직접 읽어 install_token 보존 정책이 명시적으로 기술되어 있음을 확인한다.

---

## 요약

본 draft는 `spec/1-data-model.md §2.10`의 `install_token`(line 687)과 `install_token_issued_at`(line 688) 컬럼 설명에 잔존하는 "callback 성공 시 NULL" 표기를 "callback 성공 시 보존"으로 정정하는 drift 해소 작업이다. 이미 머지된 `spec/2-navigation/4-integration.md`와 `spec/data-flow/integration.md`가 확정한 보존 정책과 현행 data-model spec 텍스트가 직접 모순을 형성하고 있으므로, 두 건의 CRITICAL이 발견된다. 이는 target draft가 정정하려는 대상 그 자체이며, draft 채택이 곧 CRITICAL 해소다. 신규 정책 도입 없이 기존 확정 정책으로의 수렴이므로, draft를 그대로 반영하는 것이 올바른 조치다. 다른 spec 영역(RBAC, Node 카테고리, API 계약, 요구사항 ID, 상태 전이, 계층 책임)과의 충돌은 발견되지 않았다.

## 위험도

CRITICAL
