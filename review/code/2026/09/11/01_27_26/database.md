# 데이터베이스(Database) 리뷰 — `impl-chat-channel-patch-token`

## 검토 방법

`git diff origin/main...HEAD --stat -- 'codebase/**'` (15 files, +1018/-166)로 이번 변경분을
확인했다. `git diff origin/main...HEAD --stat -- '*migration*' 'codebase/backend/src/**/*.entity.ts'`
는 결과 0건 — 스키마 변경·마이그레이션 파일이 이 diff 에 없다. 실제 서비스 로직 변경은
`codebase/backend/src/modules/triggers/triggers.service.ts` (+265/-\*) 한 파일에 집중돼 있어
전문(`git diff origin/main...HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts`)과
`update()` 본문을 직접 열어 확인했다. 저장소 트리는 뮤테이션하지 않았다(읽기 전용 조사만
수행, `git status --short` 로 오염 없음 확인).

이 PR 은 `chatChannel` PATCH 가 사용자 비밀(`botToken`·`inboundSigningPlaintext`)을 받지
못하도록 막는 DTO(`ChatChannelUpdateConfigDto`)와 서비스 계층 게이팅(`storeUserSuppliedSecrets`,
`assertChatChannelAlreadySetUp`, `assertPatchCarriesNoSecrets`, `inboundSigningRef` 보존
로직)을 도입한다. 이 diff 는 앞선 두 라운드(`review/code/2026/09/10/23_55_23/database.md`,
`review/code/2026/09/11/00_21_55/database.md`)가 검토한 것과 동일한 서비스 파일의 연장선이며,
이번 라운드에서 그 결론이 최신 소스에서도 유지되는지 재확인했다.

## 발견사항

- **[INFO]** (사전 존재, 재확인) `chatChannel` PATCH 는 여전히 "트리거 본체 저장 + 외부 secret
  store 쓰기 + 두 번째 DB 갱신"이 하나의 트랜잭션으로 묶여 있지 않다 — 이번 diff 가 새로 만든
  문제가 아니다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` — 첫 번째
    `this.triggerRepository.save(trigger)` 호출 이후, 조건부로 `setupChatChannel(saved, chatChannel, {...})`
    가 실행되고 그 안에서 `this.secrets.rotate(...)` (조건부, `storeUserSuppliedSecrets` 게이팅)
    와 두 번째 `this.triggerRepository.update(...)`(성공/실패 각 경로, 함수 하단)가 별도
    statement 로 실행된다. 그 사이 외부 어댑터 HTTP 호출(`adapter.setupChannel`)이 끼어 있어
    원자적이지 않다.
  - 상세: 함수 JSDoc 이 스스로 "best-effort — 실패 시 chat_channel_health=degraded" 로 명시한
    기존 설계(CCH-SE-01)다. 이번 PR 이 추가한 `assertChatChannelAlreadySetUp`/
    `previousInboundSigningRef` 캡처/`inboundSigningRefSurvives` 판정은 모두 **이미 메모리에
    있는 `trigger`/`saved` 객체를 읽는 in-memory 연산**이고, 이 비원자적 두-쓰기 구조 위에
    얹혔을 뿐 그 구조 자체를 바꾸지 않는다. 실패 경로도 `fallbackConfig`(=`internalCfg`)를
    그대로 써서 두 ref 를 함께 보존하도록 이번 PR 이 개선했다 — degraded 로 앉을 때 ref 가
    한쪽만 유실되는 비대칭을 없앤 방향의 변경이다.
  - 제안: 즉시 조치 불요. 범위(read-modify-write 구간 트랜잭션화 또는 advisory lock)는 이 PR
    을 훨씬 넘고, 두 이전 라운드 리뷰도 같은 결론(후속 등재 대상, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    §CCH-SE-01)으로 수렴했다. 재확인만 하고 새 항목으로 중복 등재하지 않는다.

## 확인된 것 — 위반 없음

- **인덱스**: 이번 diff 는 새 쿼리·새 조회 조건을 추가하지 않는다. `update()` 끝의
  `triggerRepository.findOne({ where: { id, workspaceId }, relations: ['workflow'] })` 재조회는
  이 PR 이전부터 있던 기존 패턴을 그대로 물려받았을 뿐이다(`(id, workspaceId)` PK/조합 조회로
  이미 인덱스 대상). 신규 인덱스 필요성 없음.
- **N+1 쿼리 없음**: 이번 diff 가 추가한 신규 함수(`assertChatChannelAlreadySetUp`,
  `assertPatchCarriesNoSecrets`, `assertChatChannelInputSafe` 오버로드)는 전부 이미 `findById`
  로 로드해 둔 단일 `trigger` 객체의 프로퍼티만 읽는 O(1) 검증이고 반복문 안에서 개별 쿼리를
  내지 않는다. `chatChannel` 이 실린 PATCH 1건당 `triggerRepository` 호출 횟수(초기 조회 1 +
  `save` 1 + 조건부 재조회 1)는 이번 diff 로 변하지 않았다.
- **트랜잭션**: 위 INFO 항목대로 사전 존재하는 비원자적 다단계 쓰기가 있으나, 이번 diff 의
  변경분(게이팅 플래그·검증 함수) 자체는 트랜잭션 경계를 새로 만들거나 옮기지 않는다. 오히려
  `storeUserSuppliedSecrets: false` 로 PATCH 경로에서 `secrets.rotate()` 왕복 2건(botToken,
  provider-issued signing)을 조건부로 생략해, 실패 가능한 외부 I/O 지점 수가 줄었다 — 정합성
  관점에서 중립~긍정적 방향.
- **마이그레이션 안전성**: 스키마 변경·마이그레이션 파일·엔티티 변경 0건
  (`git diff origin/main...HEAD --stat -- '*migration*' 'codebase/backend/src/**/*.entity.ts'`
  출력 없음). 무중단 배포 관점에서 검토할 대상 자체가 없다.
- **스키마 설계**: 테이블 구조·컬럼·관계 변경 없음. `trigger.config`(JSONB)라는 기존 비정규화
  저장 방식도 이번 PR 이 새로 도입한 것이 아니라 그 안의 `chatChannel` 서브필드 검증 로직만
  강화됐다.
- **커넥션 관리**: TypeORM `Repository<Trigger>` 를 통한 기존 커넥션 풀 사용 패턴 그대로이며,
  신규 raw connection 획득·수동 해제 코드는 없다.
- **SQL 인젝션**: 이번 diff 에 raw SQL 문자열 조합이 없다. `triggerRepository.save`/`update`/
  `findOne`/`findById` 는 전부 TypeORM QueryBuilder/Repository API 를 통한 파라미터화된
  쿼리이고, 신규 검증 함수들은 DB 로 내려가는 문자열을 조립하지 않는 순수 in-memory 가드다.
- **대량 데이터**: 페이지네이션·목록 조회와 무관한 단건 트리거 read-modify-write 경로다. 신규
  대용량 스캔·정렬·집계 쿼리 없음.

## 요약

이번 diff 는 chat-channel PATCH 의 비밀 필드 차단(DTO 분리)과 서비스 계층 secret 쓰기 게이팅을
추가하는 변경으로, 마이그레이션·엔티티·인덱스·raw SQL 은 전혀 건드리지 않으며 새로 추가된
검증 로직은 모두 이미 메모리에 로드된 단일 트리거 객체에 대한 O(1) 검사라 N+1 이나 신규 DB
왕복을 만들지 않는다. 사전 존재하던 "트리거 본체 저장과 secret-store/2차 DB 갱신이 원자적이지
않다"는 설계(CCH-SE-01, best-effort)는 이번 PR 범위 밖이고 이미 두 차례 리뷰에서 후속 등재로
수렴한 항목이라 재차 새 발견으로 올리지 않는다. 데이터베이스 관점에서 이 PR 을 막을 사유는
없다.

## 위험도

NONE
