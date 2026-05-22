---
worktree: chat-channel-secret-store-pgcrypto
started: 2026-05-22
owner: resolution-applier
---
# Spec Fix Draft — DIP ISecretResolver 인터페이스 (#7)

## 원본 발견사항
SUMMARY#7: DIP 미완 — `ISecretResolver` 인터페이스 없이 구체 클래스에 직접 의존. spec §2 gap.
위치: 5개 소비자 모듈 전체 (triggers, hooks, chat-channel, external-interaction, app)

## 제안 변경

`spec/conventions/secret-store.md §2 SecretResolver 인터페이스` 섹션에 다음 내용 추가:

```
### 2.1 인터페이스 정의

소비자 모듈은 구체 클래스(`SecretResolverService`) 가 아닌 추상 인터페이스에 의존해야 한다.
단, v1 구현에서는 NestJS DI 편의상 구체 클래스를 직접 inject 하는 것이 허용된다.
향후 복수 구현(예: AWS Secrets Manager 어댑터) 도입 시 인터페이스 추출을 권장.

**v1 면제 사유**:
- 단일 구현체 (`SecretResolverService`) 만 존재
- NestJS DI 에서 abstract class 사용 시 추가 설정 필요
- deleteByPrefix 포함 전체 메서드 시그니처 확정 전

**v2 행동 항목**:
- `ISecretResolver` abstract class 또는 interface 추출
- 5개 소비자 모듈의 injection token 교체
- 테스트 mock 도 `ISecretResolver` 기반으로 교체
```

## 관련 발견사항 포함
- SUMMARY#9 (`store` vs `rotate` spec §2.1 호출 규약): `rotate` 가 UPSERT 멱등성을 제공하므로
  setupChatChannel 경로에서 `store` 대신 `rotate` 사용은 허용된다.
  spec §2.1 에 "최초 저장 시 `rotate()` 사용 허용 (멱등성 보장)" 주석 추가 필요.
