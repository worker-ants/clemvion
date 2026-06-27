# 신규 식별자 충돌 검토 결과

검토 범위: `spec/conventions/swagger.md` (diff vs origin/main), `codebase/backend/src/common/swagger/api-wrapped.ts`, `api-wrapped.spec.ts`

---

### 발견사항

- **[INFO]** Rationale `§5` 레이블이 body `## 5)` 와 동일 서수 공유
  - target 신규 식별자: `### §5 ApiOkPaginatedResponse single-wrap (pass-through 예외)` (Rationale 절)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:855`, `spec/data-flow/8-notifications.md:155` 가 `swagger.md §5` 를 `## 5) 응답 DTO 규약` body 절을 가리키는 의미로 prose 에서 언급하며, HTML 앵커 `#5-응답-dto-규약` 로 명시 링크
  - 상세: Rationale 절 `### §5 ...` 는 HTML 앵커가 다르고(`#5-apiokpaginatedresponse-single-wrap-pass-through-예외`), 기존 외부 cross-ref 는 모두 body 절 앵커를 직접 지정하므로 URL 충돌 없음. 단, 링크 없이 "swagger.md §5" 로 prose 참조하는 맥락에서 Rationale `§5` 와 body `§5)` 의 혼동 가능성은 이론상 존재. 단, 이 프로젝트는 이미 `§0` (Rationale) ↔ `## 0)` (body) 동일 패턴을 사용 중이므로 새로운 관행이 아니다.
  - 제안: 현 컨벤션 유지. 변경 불필요 — `§N` Rationale 레이블은 "body section N 에 대한 Rationale" 임을 전 팀이 인지하는 확립된 패턴.

---

#### 그 외 6개 관점 점검 결과

1. **요구사항 ID 충돌**: 신규 요구사항 ID 없음. swagger.md 는 기존 문서 업데이트.
2. **엔티티/타입명 충돌**: `wrapPaginatedSchema`, `ApiOkPaginatedResponse` 모두 기존 식별자이며 새 이름 도입 없음.
3. **API endpoint 충돌**: 신규 endpoint 없음.
4. **이벤트/메시지명 충돌**: 없음.
5. **환경변수·설정키 충돌**: 없음.
6. **파일 경로 충돌**: 신규 파일 없음. 기존 파일 3개만 수정 (`swagger.md`, `api-wrapped.ts`, `api-wrapped.spec.ts`).

---

### 요약

`spec/conventions/swagger.md` 는 `ApiOkPaginatedResponse` 의 wire shape 를 double-wrap → single-wrap 으로 정정하고 Rationale `§5` 절을 신설했다. 신규 도입 식별자는 Rationale 절 레이블(`§5`) 하나이며, 이는 기존 `§0` 패턴을 따르는 내부 레이블로 외부 cross-reference URL 앵커와 충돌하지 않는다. 요구사항 ID·타입명·endpoint·이벤트·ENV·파일 경로 어느 관점에서도 충돌 없음.

### 위험도

NONE
