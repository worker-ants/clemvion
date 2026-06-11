# 유지보수성(Maintainability) 리뷰 결과

**대상**: HTTP Request 노드 — configEcho 주석 수정 + `backend-labels.ts` `HTTP_BLOCKED` 한국어 매핑 추가 (23_00_44 WARNING 해소 패치)
**검토일**: 2026-06-11
**검토 파일**:
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (주석 2건 수정)
- `codebase/frontend/src/lib/i18n/backend-labels.ts` (ERROR_KO 항목 1건 추가)

---

## 발견사항

### 1. **[INFO]** `http-request.handler.ts` configEcho 블록 주석 — 구 "automatically echoed" 구절 제거 확인
- **위치**: `http-request.handler.ts` configEcho 블록 (diff lines -155~-158 제거, +154~+158 추가)
- **상세**: 기존 주석("adding a new schema field is automatically echoed without a maintenance step here (review W-6)")이 삭제되고 명시 열거 방식의 실제 동작에 맞는 주석("adding a new schema field (http-request.schema.ts) requires adding it here too — this manual sync is intentional; it keeps the echo a known, audited surface")으로 교체됐다. 이전 세션(23_00_44)에서 WARNING #5로 지적된 모순 진술이 해소됐다. 새 주석은 유지보수 의무(schema 변경 시 이 목록 동기화 필요)를 명확하게 기술하고 있어 향후 필드 추가 시 silent omission 위험이 낮아졌다.
- **제안**: 없음. 수정 방향이 올바르다.

### 2. **[INFO]** `http-request.handler.ts` SSRF 가드 주석 — `(W-4)` 내부 태그 제거 확인
- **위치**: `http-request.handler.ts` SSRF 가드 블록 (diff lines -352~-354 제거, +350~+352 추가)
- **상세**: 기존 주석의 "(W-4)" 내부 검토 태그가 제거됐고, "이전엔 hostname literal 검사만 했기 때문에 ... 무방어였다 (W-4)" 문장이 "hostname literal 검사만으로는 공격자가 통제하는 DNS 가 공개 hostname 을 내부 IP 로 resolve 하는 DNS rebinding 시나리오에 무방어다"로 재작성됐다. 내부 이슈 번호 참조가 제거돼 외부 독자에게 불투명한 표현이 해소됐으며, DNS rebinding 위협 시나리오가 구체적으로 기술됐다. 이전 세션(23_00_44)에서 WARNING #6으로 지적된 항목이 해소됐다.
- **제안**: 없음. 수정 방향이 올바르다.

### 3. **[INFO]** `backend-labels.ts` `ERROR_KO` — `HTTP_BLOCKED` 한국어 메시지 추가
- **위치**: `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 테이블 (diff +580~+584)
- **상세**: `HTTP_BLOCKED` 키와 "보안 정책(SSRF 방지)에 의해 해당 주소로의 요청이 차단됐어요. 내부망·loopback·클라우드 메타데이터 주소는 기본 차단되며, 자체 호스팅 환경에서 사설망 접근이 필요하면 관리자가 ALLOW_PRIVATE_HOST_TARGETS 를 설정해야 해요." 메시지가 추가됐다. 이전 세션(23_00_44)에서 WARNING #7로 지적된 한국어 번역 누락이 해소됐다.
- **가독성 관점**: 메시지가 에러 원인(SSRF 방지 정책), 차단 대상(내부망·loopback·클라우드 메타데이터), opt-out 방법(ALLOW_PRIVATE_HOST_TARGETS 설정)을 한 문장에 모두 담고 있어 정보 밀도가 높다. 주변 `ENCRYPTION_KEY_MISSING` 등 메시지와 비교 시 다소 길지만, 운영자가 즉시 조치 방법을 파악할 수 있는 수준이므로 의도된 설계다.
- **인라인 주석**: 추가된 항목 위에 "refactor 04 C-3 — SSRF 가드(전 인증 방식 공통). 내부망·클라우드 메타데이터 주소 차단. self-host 가 사설망에 정당 접근해야 하면 ALLOW_PRIVATE_HOST_TARGETS." 주석이 포함되어 변경 배경과 opt-out 방법을 코드베이스 독자에게 명시한다. 파일 내 인접 항목(`ENCRYPTION_KEY_MISSING`)도 유사한 형태의 주석을 달지 않아 일관성 관점에서 미미한 차이가 있으나 정보 추가 관점에서 긍정적이다.
- **제안**: 없음.

### 4. **[INFO]** 한국어·영어 혼용 주석 패턴 — 이번 변경으로 강화 여부
- **위치**: `http-request.handler.ts` SSRF 가드 블록 전체
- **상세**: 이번 수정 후 SSRF 가드 블록 주석은 영어 본문("hostname literal 검사만으로는 공격자가 통제하는 DNS 가...")과 한국어 구문("두 layer 검증: 호스트 리터럴...")이 혼재하는 기존 패턴을 그대로 유지한다. 이번 diff 자체가 혼용 구조를 새로 도입한 것이 아니므로 이번 변경의 책임 범위는 아니다. 이전 세션(23_00_44) INFO #12에서 이미 파일 전반 혼용 패턴으로 지적됐고 해소 계획이 없는 상태이므로 인지 사항으로만 기재한다.
- **제안**: 없음 (이번 변경 범위 외).

---

## 요약

이번 변경은 직전 리뷰 세션(23_00_44)의 WARNING 3건(#5 configEcho 모순 주석, #6 내부 검토 태그 잔존, #7 한국어 번역 누락)을 정확히 해소하는 최소 범위 패치다. `http-request.handler.ts` 의 주석 수정 2건은 코드의 실제 동작과 진술이 일치하게 됐고, 향후 스키마 필드 추가 시 유지보수 의무가 명확하게 기술됐다. `backend-labels.ts` 의 `HTTP_BLOCKED` 한국어 메시지 추가는 opt-out 방법까지 포함하는 운영 친화적 내용이며 인라인 주석으로 변경 맥락도 충분히 문서화됐다. 가독성·네이밍·함수 길이·중첩 깊이·중복 코드·코드 복잡도에서 새로운 문제가 도입되지 않았으며, 기존 코드베이스 스타일과 일관성을 유지한다. Critical·Warning 수준의 유지보수성 문제는 없다.

---

## 위험도

NONE

(이전 세션 WARNING 3건이 정확히 해소됐으며 새로운 유지보수성 문제가 도입되지 않았다. 남아 있는 INFO 항목들은 모두 이번 변경 이전부터 인지된 사항이다.)
