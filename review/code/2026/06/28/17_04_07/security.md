# 보안(Security) 리뷰 결과

리뷰 대상: 44개 파일 (spec 문서 수정, review 산출물 생성, 일부 코드 관련 spec 정책 변경)

---

## 발견사항

### 코드/정책 변경 (파일 36~44)

- **[INFO]** `apiBase` 입력 검증 정책 명문화 — `safeApiBaseFromQuery` 스킴 화이트리스트
  - 위치: `spec/7-channel-web-chat/4-security.md` 신규 `apiBase 입력 검증` 행
  - 상세: host postMessage 없이 `?apiBase=` 쿼리스트링으로 폴백하는 경로에서 `javascript:`/`data:`/상대경로를 fetch base 로 사용하지 못하도록 `http(s)` 스킴만 허용하는 `safeApiBaseFromQuery` 검증 함수가 spec 에 명시됐다. 이 정책은 URL injection/XSS 방어를 위한 올바른 설계이며, 거부 시 무시+`console.warn` 처리도 fail-safe 방향으로 적절하다.
  - 제안: 구현 코드(`use-widget.ts configFromQuery/safeApiBaseFromQuery`)가 실제로 해당 스킴 검증을 수행하는지 단위 테스트로 커버되는지 확인 권장. `javascript:`, `data:`, `//` 상대 프로토콜, `file:` 등 모든 비-http(s) 케이스를 테스트 픽스처에 포함해야 한다.

- **[INFO]** `PAYLOAD_TOO_LARGE` 에러 노출 — 클라이언트 정보 노출 범위 적절
  - 위치: `spec/5-system/3-error-handling.md §1.3` 신규 행
  - 상세: 413 응답 봉투가 `{ error: { code: "PAYLOAD_TOO_LARGE", message, requestId } }` 구조로 표준화됐다. 본문 크기 초과 사실(`code`)만 노출하고 내부 임계값(`HOOKS_MAX_BODY_BYTES` 실제 값)이나 인프라 세부를 포함하지 않으므로 민감 정보 노출이 없다.
  - 제안: 없음.

- **[INFO]** 에러 메시지에서 `GENERIC_ERROR_MESSAGE` 사용 확인
  - 위치: `spec/7-channel-web-chat/4-security.md` 기존 에러 메시지 노출 행
  - 상세: 임베드 위젯이 타 사이트에서 동작하므로 서버/예외 원문을 비노출하고 일반화 문구만 표시하는 정책이 명시되어 있다. 이는 내부 스택 트레이스·인프라 정보 노출 방지에 적합한 설계다.
  - 제안: 없음.

- **[INFO]** `details[]` 필드 코드 노출 범위 (`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)
  - 위치: `spec/5-system/3-error-handling.md §1.7` 수정 행 + `spec/4-nodes/7-trigger/1-manual-trigger.md`
  - 상세: 기존에 "Planned"였던 `error.details[].code` 표면이 이번 변경으로 "구현"으로 전환됐다. 내부 분류 문자열(`missing_required`/`coerce_failed`/`invalid_schema`)이 `toTriggerParameterErrorDetails` 헬퍼를 통해 공개 `UPPER_SNAKE_CASE` 코드로 정규화된 뒤 클라이언트에 노출된다. 이 필드 코드들은 파라미터 검증 결과이며 내부 구현 세부(함수명·스택·DB 경로 등)를 담지 않으므로 노출 수준이 적절하다.
  - 제안: `toTriggerParameterErrorDetails` 가 입력 분류 문자열을 모두 화이트리스트 방식으로 매핑하는지(즉 알 수 없는 내부 키가 그대로 pass-through 되지 않는지) 코드 레벨에서 확인 권장.

- **[INFO]** rate-limit fail-open 정책 재확인
  - 위치: `spec/7-channel-web-chat/4-security.md §4` rate-limit 구현 특성
  - 상세: Redis 미가용 시 fail-open 정책("정당한 webhook 보호")이 명문화되어 있다. 이는 가용성 우선 설계로, 보안 강화가 아닌 availability 선택임이 spec 에 명시되어 있다. 기존 정책이므로 이번 변경의 신규 위험은 아니다.
  - 제안: 없음 (기존 known trade-off, spec 에 명시됨).

- **[INFO]** 인증 webhook의 본문 크기 정책 명확화 — 1MB 게이트 추가
  - 위치: `spec/data-flow/10-triggers.md`, `spec/7-channel-web-chat/4-security.md`
  - 상세: 이번 변경으로 인증 webhook에 대해 "rate-limit·공개 32KB body 한도에는 무제한"이지만 `/api/hooks/*` 라우트 스코프 1MB body-parser 게이트가 별도 적용된다는 사실이 spec에 명확히 기술됐다. 기존의 "무제한 통과" 표현을 유지하되 body 크기 제한이 별도 레이어에서 동작함을 명시해 정보 노출 없는 범위에서 공격 표면을 제한한다. OOM 방지를 위한 `HOOKS_MAX_BODY_BYTES_CEILING` 상한 클램프도 별도 spec 에 기술된다.
  - 제안: 없음.

### review 산출물 파일 (파일 1~35)

- **[INFO]** `_retry_state.json` 에 절대 경로 포함
  - 위치: 파일 5, 13, 21, 29 (`_retry_state.json` 파일들)
  - 상세: 내부 파일 시스템 절대 경로(`/Volumes/project/private/clemvion/...`)가 review 세션 상태 파일에 포함되어 있다. 이 파일들은 리뷰 산출물 디렉토리에 저장되어 git 에 커밋된다. 외부 공개 저장소라면 로컬 디렉토리 구조가 노출된다.
  - 제안: 저장소가 private 이라면 영향 없음. 만약 외부 공개 가능성이 있다면 절대 경로 대신 저장소 루트 상대 경로를 사용하도록 상태 파일 스키마를 개선할 것을 권장. 현재는 INFO 수준.

---

## 요약

이번 변경 세트는 주로 spec 문서 수정(webhook 본문 크기 정책, web-chat 보안 정책, 에러 코드 명세)과 review 산출물(일관성 검토 보고서)로 구성된다. 실제 코드 변경은 없고, spec 에 기술된 보안 정책들 — `apiBase` URL 스킴 화이트리스트 검증, `PAYLOAD_TOO_LARGE` 에러 봉투 표준화, 에러 메시지 일반화(`GENERIC_ERROR_MESSAGE`), 인증 webhook 본문 크기 1MB 게이트 명문화 — 은 모두 방어적 방향으로 올바르게 설계되어 있다. 인젝션 취약점, 하드코딩 시크릿, 인증 우회, 안전하지 않은 암호화 알고리즘 등 CRITICAL 또는 WARNING 수준의 보안 취약점은 발견되지 않았다. `_retry_state.json` 에 내부 절대 경로가 기록되는 점은 저장소가 private 임을 전제로 INFO 수준 관찰 사항이다. 구현 코드(`safeApiBaseFromQuery`, `toTriggerParameterErrorDetails`)의 실제 화이트리스트 처리가 spec 의도와 일치하는지 단위 테스트 커버리지를 통해 검증하는 것을 권장한다.

## 위험도

LOW
