# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 검토 범위 확정 (스코프 판정)

이번 라운드의 실제 target 은 `plan/in-progress/terminal-duration-sql-safety-net.md`
(`spec_impact: none`, 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 의 W10·W7 집행)이며,
착수 대상 코드는 `codebase/backend/src/shared/utils/terminal-duration.ts` 1개다. orchestrator 가
`code:` 프론트매터 역참조로 `spec/5-system/` 전체(1-auth.md·2-api-convention.md·3-error-handling.md
전문 + 나머지 15개 파일은 예산 초과로 절단)를 번들했지만, 이 영역은 **이번 세션에서 diff 가 없다**
(`git diff origin/main --stat -- spec/5-system/` → 빈 결과, worktree 는 origin/main 대비 1커밋만
앞서 있고 그 커밋도 `codebase/backend/test/terminal-duration-sql.e2e-spec.ts` 신설 + plan 문서
갱신뿐). 즉 spec/5-system/ 는 **이번 라운드가 도입하는 새 식별자가 0개**인 기존 baseline 이다.

실제로 새로 쓰인 식별자는 신설 e2e 테스트 파일(`codebase/backend/test/terminal-duration-sql.e2e-spec.ts`,
이미 커밋됨 `6f2afdad6`)과, 현재 uncommitted 로 진행 중인 뮤테이션 검증(`terminal-duration.ts` 의
`* 1000` 제거 실험) 뿐이다. 아래는 그 실제 변경 범위를 대상으로 6개 관점을 적용한 결과다.

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 신규 요구사항 ID 도입 없음 (`spec_impact: none`).
2. **엔티티/타입명 충돌** — 신설 e2e 파일이 쓰는 심볼(`PG_INT4_MAX`, `TERMINAL_DURATION_MS_SQL`,
   `TERMINAL_FINISHED_AT_PARAM`, `resolveTerminalDurationMs`, `toFiniteNumber`, `toPersistedDate`)은
   전부 `codebase/backend/src/shared/utils/terminal-duration.ts` 에서 **import** 한 기존 정의이며
   새로 정의하지 않는다. 전체 codebase grep 결과 각 심볼은 SoT 1곳(`terminal-duration.ts`)에서만
   정의되고 나머지는 전부 import/re-export 사용처였다 — 중복 정의·의미 충돌 없음. 테스트 파일 로컬
   헬퍼(`entityTable`·`entityColumn`·`toPgSql`·`durationMs`·`column`)는 파일/`describe` 블록 스코프에
   갇혀 있어 외부 노출 식별자가 아니다.
3. **API endpoint 충돌** — 신규 endpoint 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/설정 키 없음. (`spec/5-system/1-auth.md` 의
   `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOW_FALLBACK` 등은 이번 라운드가 도입한 것이
   아니라 이미 `codebase/backend/src/common/config/webauthn.config.ts` 에 등록된 기존 키다.)
6. **파일 경로 충돌** — 신설 파일은 `codebase/backend/test/terminal-duration-sql.e2e-spec.ts`
   1개뿐이며, 기존 `*.e2e-spec.ts` 명명 컨벤션(대상-기능-접미사)과 일치하고 기존 파일과 겹치지
   않는다. spec 파일 신설/이동 없음.

## 참고 (충돌 아님, 기록용)

- `spec/5-system/1-auth.md` §1.5.4 의 `invitation_*`/`forbidden`/`rate_limited` lower_snake_case
  에러 코드는 문서 자체가 "historical-artifact 예외" 로 명시하고 `error-codes.md §3` 레지스트리에
  등재되어 있음을 인용한다 — 신규 도입이 아니라 기존에 이미 조정된 예외이므로 충돌 항목 아님.
- 신설 e2e 테스트 docstring 이 "이 SQL 을 태우는 기존 e2e(`webchat-idle-reaper`)" 를 언급하나 이는
  참조일 뿐 이름 재사용이 아니다.

## 요약

이번 --impl-prep 라운드는 `spec_impact: none` 플랜이고 `spec/5-system/` 은 origin/main 대비
diff 가 없어 신규 식별자를 도입하지 않는다. 실제로 새로 작성된 코드(신설 e2e 스펙 파일)가 사용하는
모든 상수·함수명은 기존 SoT(`terminal-duration.ts`)의 import 이며 codebase 전수 grep 으로 중복
정의가 없음을 확인했다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로
6개 관점 모두에서 충돌 발견 없음.

## 위험도

NONE
