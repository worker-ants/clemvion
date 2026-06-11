# API 계약(API Contract) 리뷰 결과

## 발견사항

### 발견 없음 (INFO)

이번 변경은 기존 `GET /api/integrations/services/:type/catalog` 엔드포인트에 `makeshop` 서비스 타입 지원을 추가하는 것이 전부이다. 아래에 각 관점별 판단을 기록한다.

---

**[INFO] 1. 하위 호환성 — breaking change 없음**
- 위치: `integrations.service.ts` `getServiceCatalog()`, `integrations.controller.ts` `@ApiParam`
- 상세: `makeshop` 분기가 새로 추가되었지만 기존 `cafe24` 분기와 나머지 unknown 타입(빈 배열 반환)은 변경 없다. 기존 클라이언트가 `cafe24` 또는 미지원 타입을 호출하면 이전과 동일한 응답을 받는다. 응답 DTO 구조(`{ operations: OperationCatalogDto[] }`)도 변경 없다.
- 제안: 없음.

**[INFO] 2. 버전 관리 — 별도 버전 범프 불필요**
- 위치: 컨트롤러 전체
- 상세: 이 API 는 추가 지원 타입의 확장(opt-in)이며 기존 계약을 깨지 않으므로 API 버전 변경 없이 배포 가능하다.
- 제안: 없음.

**[INFO] 3. 응답 형식 — 스키마 일관성 유지**
- 위치: `integrations.service.ts` lines 1158–1168 (새 makeshop 분기)
- 상세: 응답 구조 `{ key, method, path, labelKey, descriptionKey }` 는 cafe24 분기와 동일한 `OperationCatalogDto` 필드셋을 따른다. `key` = `labelKey` = `makeshop.<resource>.<operation.id>` 패턴으로 일관되며, `descriptionKey` = `makeshop.<resource>.<operation.id>.description` 도 `cafe24` 대응 형식과 일치한다.
- 제안: 없음.

**[INFO] 4. 에러 응답 — 별도 에러 경로 추가 없음**
- 위치: `getServiceCatalog()` 전체
- 상세: 미지원 service type 에 대해서는 기존과 동일하게 빈 배열(`{ operations: [] }`)을 200 으로 반환한다. 이는 spec §9.3 명시 정책이다. 404 미반환 설계는 의도적이며 일관성을 유지한다.
- 제안: 없음.

**[INFO] 5. 요청 검증 — 파라미터 검증 범위 충분**
- 위치: `integrations.controller.ts` `getServiceCatalog(@Param('type') type: string)`
- 상세: `type` 파라미터는 plain string 으로 수신되며, service 가 화이트리스트 분기(`cafe24` / `makeshop` / fallback)로 처리한다. 알 수 없는 값은 빈 배열 반환이므로 별도 enum 검증 없이도 안전하다.
- 제안: 없음.

**[INFO] 6. URL/경로 설계 — RESTful 일관성 유지**
- 위치: `GET /integrations/services/:type/catalog`
- 상세: 경로 설계 변경 없음. 라우트 선언 순서(정적 prefix 우선) 주석도 그대로 유지된다.
- 제안: 없음.

**[INFO] 7. 페이지네이션 — 해당 없음**
- 이번 변경 대상 엔드포인트는 catalog(목록이지만 페이지네이션 없는 정적 메타데이터)이며, 목록 API 는 기존 그대로이다.

**[INFO] 8. 인증/인가 — 변경 없음**
- 위치: `integrations.controller.ts` class 레벨 `@ApiBearerAuth('access-token')`
- 상세: `getServiceCatalog` 는 `@Roles` 가드 없이 Bearer 인증만 요구하며, 이번 변경 전후 동일하다. Makeshop 관련 신규 엔드포인트가 추가된 것이 아니라 기존 엔드포인트의 내부 분기만 추가된 것이므로 인증/인가 정책 변경 없다.
- 제안: 없음.

---

## 요약

이번 변경은 `GET /api/integrations/services/:type/catalog` 엔드포인트에 `makeshop` 서비스 타입의 operation 카탈로그 반환을 추가한다. 기존 `cafe24` 분기와 동일한 DTO 스키마·키 컨벤션(`<provider>.<resource>.<operation>`)을 따르며, 미지원 타입의 빈 배열 fallback 동작은 유지된다. 하위 호환성·에러 응답·인증/인가·URL 설계 모두 변경이 없고, API 계약 위반이나 breaking change 는 발견되지 않는다.

## 위험도

NONE
