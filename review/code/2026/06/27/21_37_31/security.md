# 보안(Security) 리뷰 결과

## 발견사항

### 긍정적 보안 개선

- **[INFO] endpointPath UUID 강제 — 보안 향상**
  - 위치: `create-trigger.dto.ts` line 138, `update-trigger.dto.ts` line 962
  - 상세: `@IsString() @MaxLength(255)` → `@IsUUID('4')` 로의 전환. 122비트 엔트로피의 암호학적 랜덤 v4 UUID를 강제해 예측 가능한 경로 직접 지정(squatting/enumeration) 공격 벡터를 DTO 계층에서 차단한다. v1 UUID(시간 기반, 역산 가능) 거부 테스트까지 포함.
  - 평가: WH-SC-01 설계 의도와 정합하는 명시적 보안 강화.

- **[INFO] 만료 초대 토큰 정리 (WorkspaceInvitationsPrunerService)**
  - 위치: `workspace-invitations-pruner.service.ts`
  - 상세: 만료(`expires_at < now`)되고 수락되지 않은 초대 row를 매일 04:00 Asia/Seoul에 삭제함으로써, 만료된 초대 토큰이 DB에 영구 잔존하던 데이터 위생 갭을 해소한다. 공격자가 만료 토큰을 재활용(replay)하려 해도 서비스 계층의 `assertTokenUsable`이 이미 거부하지만, 잔존 row 자체를 제거해 attack surface를 줄인다.

---

### 주의사항

- **[WARNING] 클라이언트 생성 UUID가 보안 키 역할 — RNG 품질 미검증**
  - 위치: `create-trigger.dto.ts` line 138, `update-trigger.dto.ts` line 962; `spec/5-system/12-webhook.md` WH-SC-01
  - 상세: `auth_config_id IS NULL`(인증 없는 공개 webhook) 트리거에서 `endpointPath` UUID가 사실상 유일한 접근 비밀 키(WH-SC-01)로 동작한다. 서버는 v4 UUID 형식 유효성은 검증하지만 엔트로피 품질을 검증할 수 없다. 클라이언트가 약한 RNG를 사용하거나 의도적으로 저엔트로피 v4 UUID(예: `00000000-0000-4000-8000-000000000001`)를 제출해도 서버는 수락한다. 이는 설계상 수용된 트레이드오프(클라이언트가 `crypto.randomUUID()` 사용을 기대)이지만, 클라이언트 구현이 보안 보장의 전제가 된다.
  - 제안: (a) API 문서 및 스펙에 클라이언트 측 `crypto.randomUUID()` 또는 동등한 CSPRNG 사용을 **강제 요구사항**으로 명시(현재 "발급하며"로 기술 — "반드시 사용해야 한다"로 강화). (b) 장기적으로는 서버가 `endpointPath`를 직접 발급하는 선택지도 검토(클라이언트 생성 필요성이 UX 상 있다면 현 설계 유지).

---

### 정보성 항목

- **[INFO] UpdateTriggerDto의 endpointPath 허용 — 서비스 계층 불변 보장 의존**
  - 위치: `update-trigger.dto.ts` line 962
  - 상세: DTO는 `endpointPath` 수정을 받아들이지만 서비스 계층이 거부한다는 설명이 swagger 주석에만 있다. `endpointPath`가 보안 키이므로 변경 거부 로직이 서비스 계층에서 무조건적으로(우회 불가하게) 적용되는지 확인이 필요하다.
  - 제안: 서비스 계층의 endpointPath immutability 강제가 완전한지 확인. 명확성을 위해 PATCH DTO에서 해당 필드를 제거하거나 `@IsEmpty()`로 진입 자체를 막는 방안도 고려 가능.

- **[INFO] 테스트 파일 내 하드코딩 자격증명 — 테스트 전용 더미**
  - 위치: `chat-channel-trigger-create.e2e-spec.ts` line 1539-1541, `trigger-dto-validation.spec.ts` line 493-494
  - 상세: `SLACK_SIGNING_SECRET_HEX32 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'`, `DISCORD_PUBLIC_KEY_HEX64`, 봇 토큰(`'111:TelegramBotToken'`, `'xoxb-fake'`) 등이 테스트 코드에 하드코딩되어 있다. 이들은 명백히 순차적/패턴 기반의 가짜 테스트 자격증명으로, 실제 운영 비밀이 아니다.
  - 평가: 테스트 코드 내 가짜 자격증명은 허용 범위이며 보안 문제 없음.

- **[INFO] 프루너 에러 로그에 err.message 포함**
  - 위치: `workspace-invitations-pruner.service.ts` line 1373
  - 상세: `err instanceof Error ? err.message : String(err)`가 서버 로그에 기록된다. DB 에러 메시지에 내부 구조(쿼리 일부, 테이블명)가 포함될 수 있으나 서버 사이드 로그에만 기록되고 클라이언트로 노출되지 않는다.
  - 평가: 서버 내부 로그 범위이므로 정보 노출 위험 없음. 표준 패턴.

- **[INFO] languageHints 사용자 정의 메시지 — 다운스트림 렌더링 주의**
  - 위치: `trigger-dto-validation.spec.ts` line 735 이하 languageHints 테스트
  - 상세: DTO는 CCH-ERR-* 키에 대해 플레이스홀더(`{statusCode}`)만 검증하며 HTML/스크립트 콘텐츠는 새니타이징하지 않는다. 이 값들은 Telegram·Slack·Discord 등 외부 채팅 플랫폼으로 전송되며, 각 플랫폼이 자체 렌더링·이스케이핑을 처리한다. Web Chat 위젯에서 이 메시지를 HTML로 렌더링할 경우 Stored XSS 벡터가 될 수 있다.
  - 제안: Web Chat 위젯 렌더링 코드에서 `languageHints` 값을 텍스트로만 처리(innerHTML 금지, textContent 또는 동등한 이스케이핑 사용)하는지 확인.

---

## 요약

이번 변경셋의 핵심은 webhook `endpointPath`를 v4 UUID로 서버 측에서 강제하는 보안 강화(WH-SC-01)와 만료 초대 row 정리 서비스 추가다. `@IsString() @MaxLength(255)` 대비 `@IsUUID('4')`는 예측 가능한 경로 지정·열거 공격을 DTO 계층에서 명시적으로 차단하는 실질적 개선이며, v1 UUID 거부 테스트 포함이 설계 의도를 코드로 검증한다. 가장 유의할 점은 클라이언트가 UUID를 생성하고 서버가 형식만 검증하는 설계에서, 저엔트로피 v4 UUID를 제출하는 악의적·결함 있는 클라이언트를 서버가 거부할 수단이 없다는 것이다. 이는 `auth_config_id IS NULL` 트리거에서 UUID가 유일한 접근 비밀 키라는 점과 결합해 WARNING 등급의 아키텍처 취약점이나, 현행 스펙이 이를 수용된 설계로 문서화하고 있다. 그 외 발견사항은 테스트 코드 내 가짜 자격증명, 서버 로그 에러 메시지 등 정보성 수준이다. 신규 취약점 도입 없음.

## 위험도

LOW
