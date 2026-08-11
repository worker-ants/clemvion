# 보안(Security) Review — spec/7-channel-web-chat/3-auth-session.md

## 사전 검증 (orchestrator 지시사항)

직전 라운드 CRITICAL(`"stale"` 이 `scheduleRefresh` 까지 건너뛰어 세션이 영영 갱신되지 않고 고착)을
`"refresh_deferred"` 전용 갈래(스트림 open 만 건너뛰고 `scheduleRefresh` 는 반드시 예약)로 닫았다는
서술이, 공유 워크트리에서 두 차례 리뷰어 뮤테이션 하네스의 `cp` 원복에 의해 유실된 전례가 있어
`git show` 로 실제 커밋 반영 여부를 재확인했다.

- `git status`/`git diff HEAD` — 워킹 트리 clean, HEAD 와 100% 일치 (편집 유실 없음).
- `git log --oneline -5 -- codebase/channel-web-chat/src/widget/use-widget.ts` 최상단이
  `fd1075514 fix(webchat): refresh_deferred 배선 — 두 번 유실된 뒤 세 번째에 착지` 이고,
  `git merge-base --is-ancestor fd1075514 HEAD` → 참 (현재 HEAD `840c5857a` 의 조상).
- `git show HEAD:codebase/channel-web-chat/src/widget/use-widget.ts` 에서 두 호출부 모두 배선 확인:
  - `start()`: L697-717 — `outcome !== "continue" && outcome !== "refresh_deferred"` 이면 조기 return(L700),
    `outcome !== "refresh_deferred"` 일 때만 `openStream`(L716), **`scheduleRefresh()` 는 조건 없이 항상 호출**(L717).
  - 재로드/복원 경로: L1047-1074 — `deferStream = outcome === "refresh_deferred"`(L1058), `if (!deferStream) openStream(...)`(L1073),
    **`scheduleRefresh()` 역시 조건 없이 항상 호출**(L1074).
- `recoverFromExpiredToken`(L403-459)에서 `terminal`(401/410) 아닌 실패 시 `"refresh_deferred"` 반환(L447) —
  `"stale"`/`"ended"` 와 구분되는 세 번째 갈래로 존재, `SeedOutcome` JSDoc(L79-106)에도 반영됨.
- 실제 회귀 테스트 실행: `npx vitest run src/widget/use-widget-eager-start.test.ts -t "refresh 가"` →
  **3 passed**(네트워크 오류/500-비종료/soft-fail 3케이스). 그중 네트워크 오류 케이스(L448-499)는
  `phase !== "ended"` 만이 아니라 **fake timer 를 실제로 전진시켜 refresh 호출이 재발생하는지**
  (`after > before`)까지 단언해 "스트림만 안 열고 갱신도 안 도는" vacuous 통과 형태를 배제한다.

**결론**: 배선은 이번엔 유실되지 않고 커밋(`fd1075514`, HEAD 조상)에 실제로 실렸고, 비-vacuous 테스트로
고정돼 있다. 이 항목 자체는 새로운 취약점이 아니라 가용성(고착) 버그의 재발 방지 확인이며, 정상 반영을
확인했으므로 별도 CRITICAL/WARNING 을 올리지 않는다.

## 리뷰 대상 diff (spec/7-channel-web-chat/3-auth-session.md)

diff 본문은 순수 문서(spec) 변경이며 3개 편집으로 구성된다:
1. §3.1 안내 문구를 "404·복구불가 401·낙관적 refresh 는 미구현(Planned)" → "구현됐다" 로 갱신(66행).
2. "다른 병행 PR 이 같은 frontmatter 를 `partial`+`pending_plans:` 로 정정 중이며, 나중에 머지되는
   쪽이 재판정해야 한다" 는 조정 절차 안내를 추가(67-70행).
3. §3.1-2 의 "재차 `401`" 서술을 "재차 `401`·`410`" 으로 넓혀 §R4·실제 코드와 정합시킴(89행).

### 코드-문서 정합성 실측

- `404` → `finalizeEnded("execution.not_found")`: `use-widget.ts` L606-608 확인.
- `401` → `recoverFromExpiredToken` 낙관적 refresh 1회: L616-617, 재차 `401`/`410` 이면 `finalizeEnded`(L431-433, 456):
  문서가 새로 추가한 "410" 서술과 정확히 일치.
- 그 외 오류는 여전히 soft-fail 후 `"continue"`(L619-623): "일시적 장애가 대화를 끝내지 않도록 하는 경계"
  라는 새 문구와 일치, 그리고 `webchat-boot-single-flight` 사고 재발 방지 회귀 테스트(L537-)로 고정됨.

이번 diff 는 이미 구현된 동작을 문서가 뒤늦게 따라잡은 것이며, 새 코드 변경을 동반하지 않는다. 문서가
과장(실제보다 넓게 "구현됐다"고 주장)하지 않았는지 위 3곳 모두 코드로 교차 확인했고 전부 일치한다.

### frontmatter 재판정 대기 노트(67-70행)에 대한 평가

이 노트는 `status: implemented` 인 현재 frontmatter 가 다른 병행 PR 에서 `partial`+`pending_plans:`
로 바뀔 수 있음을 명시하고, "자동 가드는 이 상황을 못 잡는다" 고 스스로 한계를 적어 뒀다. 이는 보안
취약점이 아니라 **문서 정합성/프로세스 이슈**다. 다만 보안 관점에서 참고할 부분: 이 노트가 존재함으로써
어느 쪽이 나중에 머지되든 "구현 현황"과 "정식 status" 불일치가 방치되지 않도록 후속 절차
(`plan/in-progress/webchat-auth-session-status-reconcile.md`)를 명시적으로 남겨 뒀다 — 감사 추적
관점에서 적절하다. 보안 등급에 영향 없음(INFO 이하).

## 점검 관점별 결과

1. **인젝션**: 해당 diff 는 코드 변경이 없는 순수 마크다운 문서. 신규 인젝션 표면 없음.
2. **하드코딩된 시크릿**: 없음. 오히려 본문이 "클라이언트에 장기 비밀을 두지 않는다"(per_execution 단명 토큰
   전용, per_trigger 영구 토큰 미지원)는 설계를 재확인.
3. **인증/인가**: §R4(낙관적 refresh 1회 후 401/410 이면 종료 확정)의 fail-closed 설계가 문서·코드 양쪽에서
   일치함을 확인. jti blacklist(EIA §8.3, EIA-AU-04) 참조도 정확. 새로 추가된 "410" 케이스는 §R4 원문과
   기존에 어긋나 있던 §3.1-2 표현을 정정한 것으로, 넓히는 방향(더 많은 경우를 종료로 확정)이라 인가
   완화가 아니라 강화 방향의 정정이다.
4. **입력 검증**: diff 범위 밖(`apiBase` 검증·XSS sanitize 등은 `4-security.md` §1 SoT, 이번 diff 대상 아님).
5. **OWASP Top10**: 해당 없음 — 문서 갱신만.
6. **암호화**: 변경 없음.
7. **에러 처리**: "그 외 status·오류는 여전히 catch soft-fail 후 SSE 로 진행" 서술이 유지·강조됐고, 이는
   `console.warn` 진단 로그만 남기고 UI 에는 일반화 문구만 노출하는 기존 정책(`4-security.md` "에러 메시지
   노출" 행)과 일관됨. 새 노출 경로 없음.
8. **의존성 보안**: 해당 없음.

## 발견사항

없음 (CRITICAL/WARNING 대상 없음). 아래는 참고용 INFO 1건.

- **[INFO]** frontmatter `status: implemented` 가 병행 PR 의 재판정 대상으로 열려 있음(문서 정합성, 보안 영향 없음)
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:67`-`70` (게이트 기준, 신규 추가된 "frontmatter 재판정 대기" 안내문)
  - 상세: 이 diff 자체가 스스로 "자동 가드는 이 상황을 못 잡는다" 고 명시하고 후속 조정 절차 문서를
    링크해 뒀다. 실제 코드 구현은 실측대로 완전하지만(위 코드-문서 정합성 절 참조), 정식 spec `status`
    필드가 그 사실을 아직 반영하지 못한 과도기 상태다.
  - 제안: 별도 조치 불요 — 노트가 이미 `plan/in-progress/webchat-auth-session-status-reconcile.md` 로
    추적 중. 두 PR 중 나중에 머지되는 쪽이 frontmatter 를 재판정하는 절차가 이미 설계돼 있음을 확인.

## 요약

이번 diff 는 `spec/7-channel-web-chat/3-auth-session.md` 문서만 변경하는 순수 문서 업데이트로,
(1) 이미 구현된 404/401 REST 분기·낙관적 refresh 서술을 "구현됨"으로 갱신하고 (2) §3.1-2 의 "재차 401"
서술을 코드·§R4 와 일치하도록 "401·410" 으로 넓혔다. 코드(`use-widget.ts`)를 직접 열어 세 갈래
(404→ended, 401→낙관적 refresh 1회→성공 시 continue/실패(401·410) 시 ended, 그 외 오류→soft-fail
continue) 모두 문서 서술과 실측 일치함을 확인했다. 별도로 orchestrator 가 지시한 대로, 직전 CRITICAL
이었던 `refresh_deferred` 배선(스트림 open 은 건너뛰되 `scheduleRefresh` 는 반드시 예약)이 이번엔
`git show`/`git status` 로 커밋에 실제로 실려 있고 HEAD 의 조상임을 확인했으며, 관련 회귀 테스트 3건도
실행해 통과(그중 1건은 fake timer 로 갱신 사이클이 실제로 재발화하는지까지 단언하는 비-vacuous 테스트)를
확인했다. 이번 diff 범위에서 인젝션·시크릿·인가 우회·평문 전송·에러 노출 등 신규 보안 취약점은
발견되지 않았다.

## 위험도

NONE
