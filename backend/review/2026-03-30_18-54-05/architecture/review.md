### 발견사항

- **[WARNING]** `UsersController`에 응답 직렬화 로직이 직접 포함됨
  - 위치: `users.controller.ts:13-24`
  - 상세: 컨트롤러가 반환할 필드를 직접 선택(`id`, `email`, `name` 등)하고 있어 프레젠테이션 레이어에 데이터 변환 책임이 포함됨. 응답 형태가 변경될 경우 컨트롤러를 수정해야 함.
  - 제안: `UserProfileDto` 또는 `UserResponseDto`를 정의하고, 서비스 또는 별도 mapper에서 변환하거나 `class-transformer`의 `@Exclude`/`@Expose`를 활용

- **[WARNING]** 사용자 미존재 시 `404 NotFoundException` 미사용
  - 위치: `users.controller.ts:16-18`
  - 상세: `{ data: null }` 반환은 REST 컨벤션에 어긋나며, 인증된 사용자의 `/me` 엔드포인트에서 `null`이 반환되는 상황은 비정상 상태. 클라이언트가 오류 판별을 위해 `data` 값을 별도로 체크해야 하는 부담이 생김.
  - 제안: `throw new NotFoundException('User not found')` 사용

- **[WARNING]** `V003` 마이그레이션의 롤백 불가 문제
  - 위치: `V003__add_trigger_category.sql`
  - 상세: PostgreSQL에서 `ALTER TYPE ... ADD VALUE`는 트랜잭션 내에서 실행이 제한되며, 추가된 enum 값은 `DROP`이 불가능. 향후 `trigger` 카테고리 제거가 필요할 경우 별도의 데이터 마이그레이션과 enum 재생성이 필요하여 운영 부담 증가.
  - 제안: 장기적으로 `node_category`를 enum 대신 `VARCHAR` + check constraint 또는 별도 참조 테이블로 관리하는 방안 검토. 단기적으로는 현재 방식을 유지하되 이 제약을 문서화.

- **[INFO]** `users.module.ts`에 컨트롤러 등록 확인 필요
  - 위치: `users.controller.ts` (신규 파일)
  - 상세: `users.module.ts`가 수정된 것으로 표시되어 있으나 컨트롤러가 실제로 `controllers` 배열에 등록되었는지 코드에서 직접 확인되지 않음. 미등록 시 라우트가 동작하지 않음.
  - 제안: 모듈 파일에서 등록 여부 확인

- **[INFO]** `/me` 엔드포인트에 `@UseGuards(JwtAuthGuard)` 명시적 선언 부재
  - 위치: `users.controller.ts:11`
  - 상세: JWT 인증 가드가 전역 설정인지, 컨트롤러 레벨에서 적용되는지 코드만으로는 파악 불가. 명시적 선언이 없으면 의도가 불분명하고 신규 기여자가 인증 정책을 오해할 수 있음.
  - 제안: 전역 가드라면 주석 또는 모듈 설정에 명시, 아니라면 `@UseGuards(JwtAuthGuard)` 데코레이터 추가

---

### 요약

전체적으로 NestJS의 레이어 분리 구조는 유지되고 있으나, 컨트롤러가 DTO 변환 책임까지 직접 담당하고 있어 단일 책임 원칙(SRP)이 약하게 위반되고 있습니다. REST 오류 응답 처리 미흡(`null` 반환 vs `NotFoundException`)과 PostgreSQL enum의 비가역적 특성에 대한 고려가 추가로 필요합니다. 인증 가드의 명시성 부족은 모듈 경계의 가독성을 낮추며, 팀 규모가 커질수록 혼란을 유발할 수 있습니다.

### 위험도

**LOW**