# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-data-model-install-token-followup.md`
검토 파일: `spec/1-data-model.md` §2.10 (`install_token`, `install_token_issued_at` 컬럼 설명 정정)

---

### 발견사항

충돌 발견 없음.

본 변경은 두 기존 컬럼(`install_token`, `install_token_issued_at`)의 **설명 문구만 정정**하며, 신규 식별자(필드명, 엔티티명, API endpoint, 이벤트명, 환경변수, 파일 경로)를 전혀 도입하지 않는다.

점검 관점별 결과는 다음과 같다.

1. **요구사항 ID 충돌** — target이 새로 부여하는 요구사항 ID 없음. 해당 없음.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 도입 없음. 해당 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 해당 없음.
4. **이벤트/메시지명 충돌** — 신규 이벤트·메시지 이름 없음. 해당 없음.
5. **환경변수·설정키 충돌** — 신규 환경변수·설정키 없음. 해당 없음.
6. **파일 경로 충돌** — 기존 `spec/1-data-model.md`를 수정하는 것이며, 신규 spec 파일을 생성하지 않음. 해당 없음.

추가로 정정 방향의 정합성도 확인하였다. `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 항(line 969)이 "callback 성공 시 `install_token` 과 `install_token_issued_at` 모두 **보존**된다 (2026-05-16 갱신)"고 이미 명시하고 있으며, 같은 파일 line 599에서도 `pending_install → connected` 전이 시 `install_token` 보존 정책이 기술되어 있다. target이 정정하려는 `spec/1-data-model.md` line 253-254의 "callback 성공 또는 TTL 만료 시 NULL" 표현은 이 정책과 어긋나는 잔존 문구이며, 정정 내용이 코퍼스 전반과 일치한다. 충돌이 아닌 일관성 회복이다.

---

### 요약

본 변경(`spec/1-data-model.md §2.10` `install_token`·`install_token_issued_at` 설명 정정)은 신규 식별자를 전혀 도입하지 않는 순수 문구 정정이다. 새 필드명·엔티티명·API 경로·이벤트명·환경변수·파일 경로가 없으므로 식별자 충돌은 발생하지 않는다. 정정 방향 자체도 `spec/2-navigation/4-integration.md` 및 `spec/data-flow/integration.md`의 정책과 완전히 일치한다. 신규 식별자 충돌 관점에서 차단 또는 주의 사항이 없다.

### 위험도

NONE
