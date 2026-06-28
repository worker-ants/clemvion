# API 계약(API Contract) 리뷰 결과

리뷰 대상: 본 changeset 에 포함된 `spec/5-system/17-agent-memory.md` 및 `spec/2-navigation/16-agent-memory.md` 변경.

파일 1-13(`review/consistency/` 하위 산출물, `review/consistency/…/meta.json`, `_retry_state.json`)은 리뷰 artifacts 이며 API 구현 코드가 아니므로 API 계약 관점 검토 대상에서 제외한다. 실제 API 관련 변경은 spec 문서 2개에 집중된다.

---

## 발견사항

### [INFO] `DELETE /agent-memories?scopeKey=` — 204 + 커스텀 응답 헤더 패턴 신규 도입
- 위치: `spec/5-system/17-agent-memory.md` §6 API 표 + "삭제 건수 echo" bullet
- 상세: `DELETE /agent-memories?scopeKey=` 가 `204 No Content` 를 반환하면서 `X-Deleted-Count: <n>` 커스텀 헤더로 삭제 행 수를 echo 하는 패턴이 이 프로젝트에서 처음 등장한다. `spec/5-system/2-api-convention.md` §5~§6 은 응답 body 형식만 정의하고 커스텀 응답 헤더 정책을 정의하지 않았다.
  - HTTP 204는 본문 없는 표준 응답이므로 헤더를 통한 메타데이터 전달 자체는 RFC 위반이 아니다.
  - 멱등 DELETE 에 `X-Deleted-Count: 0` 을 허용하는 설계는 클라이언트가 삭제 성공/무작동을 구분할 수 있어 UX 분기에 유용하다.
  - CORS `exposedHeaders: ['X-Deleted-Count']` 추가가 spec 에 명시돼 있어(`spec/5-system/17-agent-memory.md §6 bullet`) 브라우저 크로스-오리진 접근 요건이 기술됐다.
  - 단, 이 컨벤션이 향후 다른 멱등 DELETE(예: `DELETE /agent-memories/:id` 단건)에도 적용될지 여부가 spec 에 결정되지 않았다. 현재 단건 삭제는 `X-Deleted-Count` 없이 `204` 만 반환한다 — 두 DELETE 엔드포인트 간 응답 형식 비대칭이 발생한다.
- 제안: `spec/5-system/2-api-convention.md` 에 "커스텀 응답 헤더 정책 — 언제 `X-*` 헤더로 메타데이터를 운반하는가" 항목을 추가하거나, 최소한 `spec/5-system/17-agent-memory.md Rationale` 에 이 결정이 scope 전체 삭제에만 한정되는지 명시한다. 비차단 INFO 수준.

### [INFO] `GET /agent-memories` — `scopeKey` 필수 파라미터 누락 시 오류 응답 스키마 미정의
- 위치: `spec/5-system/17-agent-memory.md` §6 API 표 (`GET /agent-memories | … scopeKey(필수) …`)
- 상세: `scopeKey` 가 필수 쿼리 파라미터이나 누락 시 반환할 HTTP 상태 코드 및 에러 응답 형식이 spec 에 기술되지 않았다. 프로젝트 표준 에러 응답 봉투(`{ code, message }`)가 적용되는지, 400 인지 422 인지 명시가 없다.
  - 기존 `spec/5-system/2-api-convention.md` 가 에러 응답 형식을 정의한다면 암묵적으로 따르겠으나, spec 표에서 개별 엔드포인트 레벨에서 필수 파라미터 누락 처리가 없으면 구현자가 임의로 결정하게 된다.
- 제안: 필수 파라미터 누락 에러 처리는 프로젝트 공통 validation 에러(400/422) 로 처리됨이 이미 암묵적 관례일 가능성이 높으므로, 별도 명시가 불필요하다면 비차단. spec 에 "validation 에러는 2-api-convention.md §X 표준 형식" 포인터 한 줄로 충분.

---

## 요약

본 changeset 의 API 관련 변경은 `spec/5-system/17-agent-memory.md` §6 API 표에 `DELETE /agent-memories?scopeKey=` 의 `X-Deleted-Count` 응답 헤더를 명문화하고, `spec/2-navigation/16-agent-memory.md` §2 에 이 헤더를 소비하는 프론트엔드 UX 분기를 기술한 것이다. 기존 API 클라이언트에 대한 breaking change 는 없다(신규 헤더 추가이며 기존 응답 필드 제거·변경 없음). CORS `exposedHeaders` 요건이 spec 에 명시돼 있어 브라우저 접근 경로가 수립됐다. 인가 설계(viewer+/editor+ 분리)와 `workspace_id` 격리도 spec 에 일관되게 기술됐다. 주요 관찰은 두 가지다. 첫째, `204 + X-Deleted-Count` 패턴이 프로젝트 최초 커스텀 응답 헤더 관례이나 `2-api-convention.md` 에 등재되지 않아 향후 동일 패턴 적용 범위가 불명확하다(INFO). 둘째, 단건 삭제(`DELETE /agent-memories/:id`)와 scope 전체 삭제 간 응답 헤더 비대칭이 발생한다(INFO). Critical 또는 Warning 수준의 하위 호환성 파괴·에러 응답 불일치·인증 누락은 없다.

---

## 위험도

LOW

STATUS=success ISSUES=0
