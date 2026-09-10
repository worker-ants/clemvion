# Database 리뷰 — chat-channel PATCH token (2026-09-11 01:52:59)

## 범위 확인

`git diff origin/main...HEAD -- codebase/` 기준 실질 변경 파일은 backend 트리거 모듈(서비스·DTO·컨트롤러·slack adapter 주석)과 frontend 문서(mdx)뿐이다. 스키마 마이그레이션 파일, 엔티티 컬럼 변경, ORM 매핑 변경은 **없음** (`codebase/backend/src/modules/triggers/entities/`, `migrations/` diff 0줄). `CHANGELOG.md`·`plan/**`·`review/**` 는 문서/산출물이라 DB 관점 검토 대상이 아니다.

## 발견사항

- **[INFO]** `TriggersService.update()` → `setupChatChannel()` 의 트리거 행 2단계 쓰기가 여전히 단일 트랜잭션이 아니다 (사전 존재 설계, 이번 diff 범위 밖 재확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` (485행대) 및 `setupChatChannel()` (1075행대, 특히 1219행 `triggerRepository.update({id: trigger.id}, {config: newConfig, ...})`)
  - 상세: `update()` 는 `triggerRepository.save(trigger)` 로 1차 커밋한 뒤, `chatChannel` 이 있으면 `setupChatChannel()` 에서 어댑터 네트워크 호출(`adapter.setupChannel`) 뒤에 **같은 트리거 행**에 2차로 `triggerRepository.update({id}, {config: newConfig, ...})` 를 건다. `newConfig` 는 `{...trigger.config, chatChannel: mergedChannel}` 로, 여기서 `trigger.config` 는 1차 `save()` 시점에 메모리에 고정된 값이다. 두 쓰기 사이(및 그 사이의 외부 API 호출 대기 시간) 에 같은 트리거에 대한 **동시 PATCH** 가 끼어들어 먼저 커밋되면, 이 2차 `update()` 가 그 동시 쓰기의 `config` 를 자신의 stale 스냅샷으로 덮어써 **lost update** 가 난다. 이번 diff 는 이 구조 자체를 바꾸지 않았고(비-트랜잭션 2단계 커밋은 CCH-SE-01 기존 설계), 오히려 `preservedInboundSigningRef` 를 그 사이에 하나 더 끼워 넣어 이 구간의 상태가 더 늘었다.
  - 근거: 같은 세션의 직전 라운드 `review/code/2026/09/10/23_55_23/RESOLUTION.md` 항목 #1 이 이미 이 문제(`동시 PATCH 가 trigger.config 를 잃을 수 있다`)를 WARNING 으로 지적했고, "사전 존재 설계(CCH-SE-01 2단계 커밋)" 사유로 **후속 등재**(현 PR 범위 밖) 처분됐다. 재조사 결과 그 처분과 다르게 볼 근거를 찾지 못했다 — 새로 만든 결함이 아니라 기존에 알려진 설계 한계이므로 CRITICAL/WARNING 으로 재상정하지 않고 INFO 로 기록만 남긴다.
  - 제안: 이미 트래킹된 항목이므로 이 PR 에서 추가 조치 불필요. 후속 작업 시 `queryRunner`/advisory lock 기반 read-modify-write 원자화를 검토할 것 (기존 백로그 방향과 동일).

- **[NONE]** SQL 인젝션 — 이번 diff 는 전부 TypeORM `Repository`/`QueryBuilder` 파라미터 바인딩 경로만 사용한다 (`assertAuthConfigInWorkspace`, `findById`, `setupChatChannel` 의 `triggerRepository.update`). 새로 추가된 raw SQL·문자열 결합 쿼리 없음.
- **[NONE]** N+1 — 이번 diff 의 신규/변경 로직(`assertChatChannelInputSafe` 오버로드, `assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`)은 전부 이미 메모리에 있는 `trigger.config` 를 들여다보는 순수 함수이고 반복문 안에서 쿼리를 새로 만들지 않는다.
- **[NONE]** 인덱스 — 신규/변경 쿼리 없음. 기존 `idx_trigger_workspace_endpoint` 참조 로직(`isEndpointPathUniqueViolation`)은 이번 diff 로 건드리지 않았다.
- **[NONE]** 마이그레이션 안전성 — 스키마 변경 파일 없음.
- **[NONE]** 스키마 설계 — 엔티티·컬럼·JSONB 구조 변경 없음. `config.chatChannel` JSONB 안의 필드 게이팅(어떤 키가 실리는지)만 바뀌었고 이는 애플리케이션 레벨 검증/쓰기 로직이지 스키마 문제가 아니다.
- **[NONE]** 커넥션 관리 — 신규 커넥션 획득/해제 코드 없음. 기존 `@InjectRepository` DI 패턴 그대로.
- **[NONE]** 대량 데이터/페이지네이션 — `findAll`/`findOneDetail` 등 목록·페이지네이션 경로는 이번 diff 의 변경 대상이 아니다.

## 요약

이번 변경은 chat-channel PATCH 의 시크릿 필드 차단(D-1/D-2, 검증 계층)에 집중된 보안·계약 수정으로, 스키마·마이그레이션·인덱스·쿼리 형태를 건드리지 않는다. SQL 인젝션·N+1·커넥션 누수 등 새로 도입된 DB 결함은 없다. 유일하게 DB 관점에서 남는 것은 `TriggersService.update()` → `setupChatChannel()` 의 비-트랜잭션 2단계 트리거 행 쓰기로 인한 동시 PATCH lost-update 가능성인데, 이는 이번 diff 가 만든 것이 아니라 CCH-SE-01 의 사전 존재 설계이며 직전 리뷰 라운드에서 이미 WARNING 으로 식별·후속 백로그 등재된 항목이라 이번 라운드에서는 INFO 로만 재확인한다.

## 위험도

LOW
