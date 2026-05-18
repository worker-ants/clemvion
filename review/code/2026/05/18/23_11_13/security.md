# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `send-email.schema.ts` — `attachmentSchema` 에서 `path` 필드를 의도적으로 제외하고 `disableFileAccess: true` 방어선을 주석으로 명시
  - 위치: `send-email.schema.ts` (전체 파일 컨텍스트 1316~1349행 영역, 주석 블록)
  - 상세: 코드 주석이 nodemailer 의 `path` 옵션을 통한 로컬 파일 읽기(path traversal / arbitrary file read) 위험을 명확히 인지하고, 스키마 단계에서 `path` 필드를 제거하며 핸들러 단에서 `disableFileAccess: true` 를 추가한다고 설명하고 있다. 이 변경 범위에서 직접 수정이 이루어지지는 않았으나, 해당 방어 로직이 실제 핸들러(`mapAttachmentsForNodemailer`)에서 구현되어 있는지 리뷰 범위 내 코드만으로는 확인할 수 없다.
  - 제안: 핸들러 코드에서 `path` 필드 제거와 `disableFileAccess: true` 가 실제로 적용되어 있는지 별도 핸들러 리뷰에서 확인할 것을 권장한다. 스키마 주석의 의도가 핸들러 구현과 일치하는지 통합 테스트 또는 코드 리뷰로 검증하는 것이 바람직하다.

- **[INFO]** `http-request.schema.ts` — `keyValueSchema` 에서 CRLF 인젝션 방어 적용 확인
  - 위치: `http-request.schema.ts` 전체 컨텍스트, `NO_CRLF_RE` 정의 및 `keyValueSchema`
  - 상세: HTTP 헤더/쿼리 파라미터 key·value 양쪽에 `^[^\r\n]*$` 정규식으로 CRLF 문자를 schema 단계에서 거부한다. 테스트(`http-request.schema.spec.ts:484-494`)가 `\r\n`, `\n`, `\r` 모두를 커버한다. 핸들러에도 `stripCrlf` 추가 방어선이 있다고 주석에 명시되어 있어 defense-in-depth 구조가 적절히 갖춰져 있다.
  - 제안: 현재 구현은 양호하다. 이 변경에서 직접 수정은 없으나 새로 추가된 테스트가 이 방어를 회귀 방지하고 있다는 점은 긍정적이다.

- **[INFO]** `switch.schema.ts` — `caseDefSchema.id` 에 슬러그 형식 및 예약어 필터링 적용
  - 위치: `switch.schema.ts` `caseDefSchema` 정의, `RESERVED_CASE_IDS` 집합 및 `validateSwitchConfig`
  - 상세: 포트 라우팅 키로 직접 사용되는 `case.id` 에 대해 `/^[a-zA-Z0-9_-]+$/` 정규식과 최대 64자 제한을 schema 단계에서 적용하고, `validateSwitchConfig` 에서 `default`, `out`, `error` 등 예약 포트 이름 충돌을 차단한다. 공백·특수문자·HTML/인젝션 가능 입력이 포트 키로 전파되는 것을 명시적으로 방어하고 있다.
  - 제안: 현재 구현은 적절하다. 이 변경에서 추가된 `requiredWhen` 메타데이터는 이 방어 로직과 무관하며 위험을 추가하지 않는다.

- **[INFO]** `validateSendEmailConfig` — 이메일 주소 형식 검증 부재
  - 위치: `send-email.schema.ts` `validateSendEmailConfig` 및 `isRecipientsLike` 함수
  - 상세: 이 변경에서 수정하지 않은 기존 로직이지만, 수신자 필드(`to`, `cc`, `bcc`)가 "비어있지 않은 문자열 또는 비어있지 않은 문자열 배열" 여부만 검사하고 실제 이메일 주소 형식(RFC 5321)을 검증하지 않는다. 악의적이거나 잘못된 이메일 주소가 nodemailer 로 전달될 수 있다.
  - 제안: 이 변경의 직접 범위는 아니지만, 향후 이메일 형식 검증(예: 정규식 또는 `zod().email()`)을 `isRecipientsLike`에 추가하는 것을 검토할 것을 권장한다. nodemailer 자체의 SMTP 에러를 통해 실패하더라도 잘못된 형식의 주소가 외부 SMTP 서버에 전송 시도되는 것은 부적절하다.

- **[INFO]** `loop.schema.ts` — `breakCondition` 필드 표현식 검증 없음
  - 위치: `loop.schema.ts` `loopNodeConfigSchema.breakCondition`
  - 상세: 이 변경에서 수정하지 않은 기존 필드이다. `breakCondition` 은 `z.string().optional()` 로 선언되어 어떤 문자열도 허용된다. 런타임에 이 필드가 표현식 엔진에서 평가될 경우, 입력 검증 없이 임의의 표현식이 전달될 수 있다. 표현식 엔진의 샌드박싱 수준에 따라 리스크가 달라진다.
  - 제안: 표현식 필드의 안전성은 런타임 표현식 엔진의 샌드박스 구현에 의존하는 구조이다. 표현식 엔진이 적절히 격리되어 있는지 별도 리뷰를 권장한다. 이 변경의 직접 범위는 아니다.

- **[INFO]** `databaseQueryNodeConfigSchema` — `query` 필드 SQL 인젝션 방어는 스키마 레이어 범위 밖
  - 위치: `database-query.schema.ts` `databaseQueryNodeConfigSchema.query`
  - 상세: 이 변경은 `query` 필드에 `ui.required: true` 메타를 추가할 뿐이다. `query` 는 `z.string().optional()` 로 자유 문자열을 허용한다. SQL 인젝션 방어는 스키마가 아닌 실행 핸들러에서 파라미터 바인딩(`parameters` 필드)을 통해 이루어져야 한다. 스키마 수준에서는 별도로 검증하지 않는다.
  - 제안: 이 변경 자체는 SQL 인젝션 위험을 도입하거나 제거하지 않는다. 핸들러에서 쿼리를 파라미터 바인딩 방식으로 실행하는지 핸들러 리뷰에서 확인할 것을 권장한다. `parameters` 필드가 존재하는 것은 바인딩 방식을 지원한다는 좋은 신호이다.

### 요약

이번 변경의 핵심은 노드 설정 스키마의 `ui.required` / `ui.requiredWhen` 메타데이터를 `warningRules` SSOT 와 정렬하는 UI 힌트 추가 작업이다. 변경된 코드는 런타임 동작이나 데이터 흐름에는 영향을 주지 않으며, Zod 스키마의 `meta()` 영역에만 국한된 프론트엔드 표시 메타 정보 추가이다. 하드코딩된 시크릿, 인증/인가 우회, 인젝션 취약점, 암호화 문제 등 보안 취약점은 이번 변경 범위에서 발견되지 않았다. 기존 코드에서 이미 갖춰진 방어 메커니즘(CRLF 인젝션 방어, path traversal 방어 주석, switch case id 슬러그 제한)은 이 변경으로 영향받지 않는다. 일부 INFO 수준 항목은 이 변경 범위 밖의 기존 코드에 대한 후속 검토 사항으로 기록한다.

### 위험도

NONE
