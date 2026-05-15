### 발견사항

- **[INFO]** `configService.get()` 반복 호출
  - 위치: `mail.service.ts` `sendVerificationEmail()` (라인 20, 22)
  - 상세: `frontendUrl`과 `transport`를 매 호출마다 ConfigService에서 조회. ConfigService 내부적으로 캐싱되어 있어 심각하지 않으나, 동일 값을 반복 요청하는 패턴.
  - 제안: 생성자에서 `private readonly frontendUrl` 등으로 한 번만 읽어두면 명시적으로 더 효율적.

- **[INFO]** HTML 템플릿 매번 새로 빌드
  - 위치: `mail.service.ts` `buildVerificationHtml()` / `buildVerificationText()`
  - 상세: 이메일 템플릿 구조(고정 부분)가 매 호출마다 새로 생성됨. 고빈도 호출 시 반복적인 문자열 할당 발생. 현재 인증 메일 특성상 빈도가 낮아 실질적 영향은 미미함.
  - 제안: 템플릿 리터럴 유지하되, Handlebars 등 템플릿 엔진 도입 시 컴파일된 템플릿을 재사용하는 구조가 더 효율적.

- **[INFO]** `buildVerificationText()`의 `Array.join()` 패턴
  - 위치: `mail.service.ts` 라인 60–69
  - 상세: 배열 생성 후 join으로 합치는 방식은 템플릿 리터럴보다 중간 배열 객체를 추가 할당함. 이 규모에서는 무의미한 차이이나 불필요한 패턴.
  - 제안: 템플릿 리터럴로 교체.

### 요약

리뷰 대상 코드는 단순한 이메일 발송 서비스로, 성능에 직접 영향을 주는 구조적 문제는 없다. ConfigService 반복 조회와 배열 기반 텍스트 빌딩 등 미세한 비효율이 있지만, 이메일 발송은 본질적으로 네트워크 I/O가 지배적인 작업이므로 이 수준의 최적화는 실제 성능 개선 효과가 거의 없다. 비동기 처리가 올바르게 구현되어 있고, 메모리 누수나 블로킹 I/O 이슈는 존재하지 않는다.

### 위험도

**NONE**