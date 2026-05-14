전체 spec 파일을 읽었습니다. 이제 convention compliance 분석을 수행합니다.

---

## Convention Compliance Check — `spec/2-navigation/4-integration.md`

### 발견사항

---

**[WARNING]** §10.1 내 "본 PR" 역사 참조 — spec 최종 상태 기술 원칙 위반

- **target 위치**: §10.1 엔드포인트, 주석 내
  ```
  (통합 연동용은 본 PR 의 namespace 이전과 동시에 새 URI 로 갱신)
  ```
- **위반 규약**: CLAUDE.md §프로젝트 스펙 문서 — "history 가 아닌 latest 에 대한 기술이므로"
- **상세**: `spec/` 문서는 최종 상태를 서술해야 한다. "본 PR" 은 작성 시점의 진행 중 PR 을 가리키며, 이 PR 이 merge 된 이후에는 "어느 PR?" 이라는 혼란이 발생한다. 이미 merge 된 시점에서는 문서에 이전 작업의 이름이 남는 역사 기록이 된다.
- **제안**: 해당 괄호 주석을 현재 상태 서술로 교체
  ```
  Google Cloud Console / GitHub OAuth App 에는 두 redirect URI 가 모두 등록되어 있어야 한다.
  통합 연동용: /api/3rd-party/:provider/callback, 소셜 로그인용: /api/auth/oauth/:provider/callback
  ```

---

**[INFO]** §9.4 `INTEGRATION_TEST_FAILED (422)` — swagger 표준 상태 코드 목록에 422 없음

- **target 위치**: §9.4 공통 응답 포맷, 에러 코드 목록
  ```
  `INTEGRATION_TEST_FAILED` (422) — 연결 테스트 실패
  ```
- **위반 규약**: `spec/conventions/swagger.md` §2-4 상태 코드 응답 규칙
  - 표에 정의된 코드: 200, 201, 204, 400, 401, 403, 404, 409. **422 는 미포함**
- **상세**: 422 Unprocessable Entity 를 사용하는 근거가 spec 내 어디에도 없다. 연결 테스트 실패는 "입력값이 문법적으로 올바르나 비즈니스 로직 실패"인 422 보다, 서버가 검증 후 처리 불가로 판정하는 400 또는 서버 처리 가능하나 외부 연동 실패인 502/503 으로 표현하는 것이 swagger 컨벤션의 일관성에 더 부합한다.
- **제안**: 연결 테스트 실패 시 400 (`INTEGRATION_TEST_FAILED`) 으로 변경하거나, 422 채택 배경을 Rationale 에 추가하고 swagger.md 표를 갱신. 후자가 적절한 경우 이 사항이 WARNING 으로 격상될 수 있다.

---

### 요약

`spec/2-navigation/4-integration.md` 는 전반적으로 정식 규약을 잘 준수하고 있다. Cafe24 API 메타데이터 컨벤션(`cafe24-api-metadata.md`)의 18-resource 목록 및 scope 체계와 일치하고, 마이그레이션 컨벤션은 직접 해당 사항 없음, node-output 컨벤션의 error code `UPPER_SNAKE_CASE` 규칙도 API 에러 코드 전반에서 준수된다. swagger 컨벤션의 `{ data: ... }` wrapping 및 409 충돌 처리도 올바르게 사용되었다. 유의미한 위반은 1건(§10.1 "본 PR" 역사 참조)으로, spec 최종 상태 기술 원칙에 어긋나는 표현이며 수정이 권장된다. 422 상태 코드는 swagger 컨벤션 표에 없는 코드 사용으로 INFO 수준 지적 사항이다.

### 위험도

**LOW**