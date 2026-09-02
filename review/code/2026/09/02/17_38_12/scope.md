# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 실패/미완료 `--impl-prep` 재시도 세션 6개 중 5개가 빈 상태로 커밋에 포함됨
  - 위치: `review/consistency/2026/09/02/17_08_55/`, `17_09_30/`, `17_11_15/`, `17_11_16/`, `17_11_33/`, `17_11_34/` (각 `_retry_state.json`·`meta.json`만 존재, 실제 checker 산출물 없음) — 성공한 최종 런은 `review/consistency/2026/09/02/17_13_02/`(SUMMARY.md + checker 5개 전문)
  - 상세: `git log --oneline -- <각 경로>` 로 확인한 결과 이 6개 디렉터리 전부 이번 구현 커밋(`b019d7de3`)에서 신규 생성됐다. 이 중 5개는 `_retry_state.json`/`meta.json`만 있고 `SUMMARY.md`나 checker 출력이 전혀 없다 — `--impl-prep` 게이트를 여러 번 재시도(레이트리밋/세션 문제 등)한 흔적으로 보이며, 정보 가치가 없는 빈 세션이 diff 에 27개 파일 중 12개(약 44%)를 차지한다. `review/consistency/**` 저장 자체는 프로젝트 규약(`CLAUDE.md` "일관성 검토 산출물" 표)에 맞고, 최종 성공 런(`17_13_02`)이 plan 파일이 인용하는 실제 근거이므로 이 항목이 기능 변경에 영향을 주지는 않는다. 다만 실패한 빈 세션까지 커밋에 남기는 것은 리뷰 범위상 "무관한 산출물 포함"에 해당할 수 있어 참고로 남긴다.
  - 제안: 차단 사유는 아님. 다만 향후엔 성공한 최종 세션 디렉터리만 커밋하거나(빈 재시도는 `.gitignore`/정리), 재시도 산출물을 남기는 이유를 커밋 메시지에 한 줄 남기면 다음 리뷰어가 "게이트가 왜 6번 돌았나"를 다시 추적하지 않아도 된다.

## 요약

핵심 코드 변경(`websocket-events.types.ts`의 `AuthEventType`/`AuthTokenExpiredPayload` 신설, `websocket.gateway.ts`의 만료 타이머 `armExpiryTimers`+정리 로직, 대응 `websocket.gateway.spec.ts` 테스트, 프런트 `ws-client.ts`의 `auth.token_expired`/`disconnect(io server disconnect)` 재연결 핸들러와 그 테스트)는 plan 문서(`plan/in-progress/ws-token-expired-socket-lifetime-impl.md`)와 spec 결정(`R-ws-socket-lifetime-binds-token`)이 명시한 "backend 타이머 둘 + frontend 구독·재연결" 범위와 1:1로 대응하며, 요청 이상의 리팩토링·기능 확장·무관한 포맷팅/주석/임포트 변경은 발견되지 않았다. `spec/` 은 이번 커밋에서 건드리지 않아 developer 쓰기 경계도 지켜졌다. `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` 체크리스트 갱신과 신규 `ws-token-expired-socket-lifetime-impl.md` plan 파일도 작업 추적 목적의 정상 산출물이다. 유일한 관찰 사항은 `--impl-prep` 게이트를 여러 차례 재시도한 빈 세션 디렉터리 5개가 함께 커밋된 점으로, 기능에는 영향이 없는 절차적 부산물이다.

## 위험도
NONE
