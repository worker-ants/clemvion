# 문서화(Documentation) 리뷰 — CHANGELOG 백필 12건 재판정

## 발견사항

- **[CRITICAL]** `#1263` 백필 항목의 ratchet baseline 수치 "51건 · 14파일"이 실제 병합된 최종값과 다르다 — 정답은 52건 · 15파일
  - 위치: `CHANGELOG.md:60`, `plan/in-progress/changelog-backfill-12.md:30`
  - 상세: 두 파일 모두 `#1263`(`frontend-checks` 타입체크 ratchet 신설)의 baseline 을 "51건 · 14파일"로 적었다. 그러나:
    1. 저장소에 실재하는 `scripts/frontend-typecheck-baseline.json` 은 `"total": 52`, 파일 15개(합계 52)다 — 직접 파싱해 확인.
    2. 그 파일을 건드린 커밋은 `7b2604eb5`(`#1263`) 단 하나뿐이다(`git log -- scripts/frontend-typecheck-baseline.json`) — 이후 아무도 갱신하지 않았다.
    3. `#1263` 자신의 PR 본문(스쿼시 커밋 메시지 전문)을 읽으면, 최초 측정은 "51/14"였으나 **리뷰 1라운드에서 정규식이 Next.js route group 경로(`src/app/(main)/...`)를 통째로 잘라먹는 버그를 발견**해 "baseline 재생성: 51/14 → 52/15"로 스스로 정정했고, 이후 2R·3R 검증 로그에도 일관되게 "frontend ratchet **52/15**"로만 등장한다. 즉 "51/14"는 그 PR 안에서 **이미 반증되고 대체된 중간값**이다.
  - 이 값이 그대로 CHANGELOG 에 커밋되면, "판정은 main 대비"·"수치는 그 PR 본문 그대로 대조했다"는 이 plan 자신의 검증 규율(§C)에도 불구하고, PR 본문 **앞부분만** 읽고 뒤에서 스스로 정정한 최종값을 놓친 것이 된다 — CHANGELOG 는 영구 이력이므로 이 오차는 자동으로 낡지 않고 그대로 남는다. 같은 세션의 consistency-check 가 `#1238`(“spec 0” 근거 오류)에 대해 이미 낸 경고와 정확히 같은 클래스의 결함이며, 그 checker 는 CHANGELOG.md 자체의 수치를 대조 대상으로 삼지 않아 이번엔 못 잡았다.
  - 제안: `CHANGELOG.md`·`plan/in-progress/changelog-backfill-12.md` 두 곳 모두 "51건 · 14파일" → "52건 · 15파일"로 정정한다. 같은 클래스의 재발을 막으려면, 백필 판정 시 PR 본문에 같은 지표가 **여러 차례 다른 값으로 등장**하면(리뷰 라운드로 인한 자기 정정) 반드시 마지막 값 또는 저장소의 현재 파일을 정본으로 삼는다는 절차를 plan 관례에 남길 만하다.

## 확인된 사항 (발견사항 아님 — 검증 기록)

리뷰 대상은 `CHANGELOG.md`(6개 백필 항목 + 상단 기준 문구 2곳 보강), `plan/in-progress/changelog-backfill-12.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(체크박스 완료 표기 + 요약 8줄 추가), 그리고 이 작업 자체를 검증한 `review/consistency/2026/09/25/13_31_14/*`(5개 checker + SUMMARY + meta) 세션 산출물이다.

- **형식 준수**: 신규 6개 항목 모두 `## Unreleased — <제목> (#PR … CHANGELOG 누락 backfill)` 접두를 정확히 따른다. `convention_compliance.md` INFO#3 이 "이 포맷 준수 여부는 code-review 또는 후속 검토에서 재확인"하라고 명시적으로 위임했는데, 이번 검토가 그 재확인이다 — 통과.
- **교차 참조 실재성**: 신규 항목이 인용하는 경로·식별자를 직접 확인했다 — `plan/complete/changelog-criteria.md`, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`, `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`, `ChatChannelRotateBotTokenDto`(`chat-channel-rotate-bot-token-response.dto.ts`) 전부 실재. `.unref()` 도 `websocket.gateway.ts:224-225`에 실재.
- **PR별 수치 재검증**(`git log -1 --format=%B <sha>` 대조): `#1354` "여덟 곳", `#1358` "아홉 곳", `#1261` "18개", `#1275` "135개", `#1245` "536개" — 전부 해당 PR 커밋 메시지의 최종 수치와 일치. `#1263` 만 위 CRITICAL 항목으로 불일치.
- **선행 consistency-check 경고 반영 확인**: `--plan` 세션(`13_31_14`)이 낸 WARNING 2건(cross_spec `#1238` "spec 0" 근거 오류, plan_coherence `#1270` 캐비엇 누락)이 plan 표(`~~spec 0~~` 취소선 정정, `#1270` 행의 캐비엇 삽입)와 실제 CHANGELOG 본문(`WS 토큰 만료…` 항목의 "캐비엇" 문단)에 **양쪽 다** 반영돼 있다. 자기-반증형 소정정에 준하는 방식(원문 취소선 보존 + 정정 병기)으로 처리한 점도 문서 이력 추적성 관점에서 적절하다.
- **plan 체크리스트 상태**: `/ai-review`·`plan/complete/` 이동 두 항목이 미체크로 남아 있는데, 이는 이 리뷰가 실행되는 시점의 정상 상태(리뷰 완료·fix 반영 후 마무리 커밋에서 체크될 항목)이며 결함이 아니다.
- **독스트링/README/API 문서/설정 문서/예제 코드** 관점: 이번 변경은 코드가 아닌 CHANGELOG·plan 문서 자체이므로 해당 관점은 원천적으로 적용 대상이 아니다(코드 diff 없음).

## 요약

CHANGELOG 백필 작업 자체는 형식·교차 참조·선행 consistency-check 경고 반영이 모두 견고하다. 다만 `#1263` 항목의 ratchet baseline 수치("51건·14파일")는 해당 PR 이 리뷰 1라운드에서 스스로 정정한 이전 값이며, 저장소에 실재하는 baseline 파일(52건·15파일)과도 어긋난다 — CHANGELOG 는 영구 이력이라는 이 작업의 전제에 정면으로 배치되는 결함이므로 CRITICAL 로 분류했다. 이 한 곳만 정정하면 나머지는 병합해도 좋다.

## 위험도

CRITICAL — 부정확한 수치가 영구 이력 문서(CHANGELOG.md)에 그대로 커밋될 위험이 실재하며, 근거(저장소 파일·해당 PR 커밋 이력)로 직접 반증됨.
