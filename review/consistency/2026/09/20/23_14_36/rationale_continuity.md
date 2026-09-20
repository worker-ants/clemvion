# Rationale 연속성 검토 — spec/2-navigation (--impl-done)

## 전제 확인

- `spec/2-navigation` 자체의 diff 는 0개 파일 — 이번 PR 은 spec 을 바꾸지 않는다 (`plan/in-progress/trigger-dup-delete.md` frontmatter `spec_impact: none`).
- 실제 코드 diff(HEAD, `origin/main...HEAD`): `codebase/backend/src/modules/triggers/triggers.service.ts`(+14) · `triggers.service.spec.ts`(+74/변경) · `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`(신규 127줄) + `CHANGELOG.md` + `plan/in-progress/*` 2건.
- 따라서 본 검토는 "target 문서(spec/2-navigation) 안의 새 서술이 자기 자신의 과거 Rationale 을 위반하는가" 가 아니라, "구현이 target 문서에 이미 박혀 있는 Rationale·본문 註(§3 동시 쓰기 직렬화, §4.3 cascade, §4.4 결과·에러)를 위반하지 않는가" 를 실측 코드로 재확인하는 형태다. 직전 `--impl-prep` 라운드(`review/consistency/2026/09/20/21_43_47/rationale_continuity.md`)가 **설계 방향**을 이미 NONE 으로 판정했으므로, 이번엔 그 설계가 실제로 그대로 구현됐는지를 코드로 대조했다.

## 발견사항

### [INFO] 외부 teardown 중복 잔여가 spec §4.3 Rationale 표의 "남는 창" 목록에는 없고 plan/CHANGELOG 에만 있다

- target 위치: `spec/2-navigation/2-trigger-list.md` §4.3 "트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다 (2026-09-17 결정)" 문단의 "남는 창은 외부 자원 쪽이다" 목록.
- 과거 결정 출처: 같은 §4.3 문단 자체 — 이미 "외부 해제용 열거 뒤에 생긴 트리거" · "해제 뒤·행 삭제 전에 동시 요청이 다시 만든 provider 등록·schedule job" · "워크스페이스 삭제 권한 선검사/잠금 재검사 사이 역할 변경" 세 종류의 외부-자원-잔여를 명시적으로 나열해 두었다.
- 상세: 이번 구현(`triggers.service.ts` `remove()`)은 `findById`(무락) → `resourceReleaser.releaseExternal(trigger)`(락 밖, 트랜잭션 밖) → advisory lock → 재조회(`!fresh` → 404) 순서를 그대로 유지한다. 즉 **두 동시 DELETE 요청 모두 `releaseExternal`을 각자 실행한 뒤**에야 한쪽만 advisory lock 안에서 실제 삭제/404 가 갈린다 — 락을 얻어도 "이미 진 요청이 releaseExternal 을 이미 실행했다"는 사실 자체는 막지 않는다. 이 결과 schedule 타입·chat-channel 타입 트리거를 동시에 두 번 DELETE 하면 BullMQ `removeJobScheduler`·provider teardown 이 같은 대상에 두 번 불릴 수 있다. 이 잔여는 developer 가 **인지하고 있고 문서화도 했다** — `CHANGELOG.md`("외부 provider teardown(chat-channel 등) 중복 호출도 이 PR 이 닫지 않는다(락 밖, 멱등 전제 유지)")와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커(§4.3 "남는 창" 하위 항목으로 새로 추가, `/ai-review` `22_07_23` side_effect·concurrency WARNING 1 인용)에 각각 적혀 있다. 새 e2e(`trigger-delete-concurrency.e2e-spec.ts`)도 의도적으로 chat-channel 없는 webhook 트리거만 써서 이 경로를 비켜간다고 주석에 명시했다. 즉 **결정의 무근거 번복이나 은폐된 축소가 아니라 명시적으로 좁힌 스코프**이며, §3 註의 "외부 provider 호출은 락 밖이다" 원칙과도 배치되지 않는다(락 안으로 옮기면 그 원칙을 어기게 된다).
- 제안: 위 사실 자체는 위반이 아니므로 차단 사유가 아니다. 다만 spec `§4.3` 이 이미 같은 종류의 "남는 창"을 스스로 나열하는 관례를 갖고 있으므로, 이 트리거 대 트리거(동일 트리거 이중 DELETE) 케이스도 같은 목록에 한 줄 추가해 두면 이 잔여가 plan(휘발성 있는 in-progress 문서, 완료 후 `plan/complete/` 이동·시간 경과 시 archive 대상)에만 남아 있다가 유실되는 것을 막을 수 있다. 강제 사항은 아니며 후속 planner 턴에서 처리해도 무방하다.

## 정합성 확인 — 위반 없음으로 판정한 근거

1. **§3 "동시 쓰기 직렬화" 원칙 그대로 확장 적용.** 새 코드의 `const fresh = await m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } }); if (!fresh) this.throwTriggerNotFound();` 는 §3 이 이미 명문화한 "락 안에서도 행 부재를 판정한다: 재읽기가 비면 쓰지 않고... 쓰지 못한 것으로 취급한다"를 삭제 경로에 그대로 옮긴 것이다. 새 정책 도입이 아니라 기존 결정의 완결이며, 직전 impl-prep 라운드가 이미 이 방향을 "정합"으로 확인했다.
2. **§4.4 "동시 삭제 → 두 번째 404" 문구가 이제 코드로도 사실이 됐다.** `throwTriggerNotFound()` 는 기존에 `findById` 등 다른 경로가 이미 쓰던 동일 `RESOURCE_NOT_FOUND` 헬퍼를 재사용한다 — 신규 에러 코드 신설 없이 §4.4 텍스트와 정확히 일치. 직전 --impl-prep 리뷰가 남긴 유일한 INFO("§4.4 가 검증 미필 상태로 캐버트 없이 남아 있다")는 이번 구현으로 자연 해소됐고, 트래커도 그 사실을 취소선 + 처분 문구로 정정했다(`spec-draft-nullable-notation-followups.md` (b) 항목, 2026-09-20).
3. **§3 "외부 provider 호출은 락 밖이다" 원칙 위반 없음.** `releaseExternal` 은 여전히 advisory lock 밖·트랜잭션 밖에서 실행되며, 이번 diff 는 그 위치를 바꾸지 않았다.
4. **비밀 정리 순서(§4.3 "행 삭제 커밋 뒤에 지운다")도 유지.** 404 로 끝나는 경로(진 쪽)는 `releaseSecretsAfterCommit`·`recordAudit` 를 아예 타지 않도록 `.catch` 에서 `NotFoundException` 을 그대로 재던지게 분기했다 — "쓰지 못했으면 락 밖에서 만든 것을 되돌린다"는 §3 원칙과 결이 같다(다만 여기서 "되돌릴 것"은 원래 없다 — DELETE 는 새로 만드는 대신 이미 존재하던 것을 지우려는 시도이므로 되돌릴 대상이 없고, 진 쪽은 단순히 아무것도 더 하지 않는다).
5. **오류 로그의 거짓 경보 방지도 §4.3 취지와 일치.** 기존 catch 블록의 "반쯤 삭제된 상태다 · 수동 정리가 필요하다" 로그는 원래 genuine 실패를 향한 것이었는데, 재조회로 새로 생긴 404 케이스까지 그 로그를 타면 "먼저 커밋한 요청이 이미 다 정리한" 정상 사건을 이상 신호로 오인시킨다 — `if (err instanceof NotFoundException) throw err;` 로 갈라 이를 막았다. 이는 워크플로/워크스페이스 삭제 형제 경로(`plan/complete/dup-delete-audit.md` 계보)가 이미 쓰는 것과 같은 패턴이라는 것이 CHANGELOG·plan 양쪽에 명시돼 있다.
6. **기각된 대안의 재도입 없음.** 이번 diff 범위(3파일)에서 `2-trigger-list.md` R-1~R-17 중 취소선·폐기 처리된 항목(R-2 등)을 다시 살리거나, 폐기 이유를 무시하고 되돌리는 자리는 없다.
7. **결정 번복 시 새 근거 기록 관례 준수.** plan(`trigger-dup-delete.md`)이 스스로 "네 자리 완결"이라 과장했던 제목/커밋 메시지를 정정 문구로 취소선 처리하고 실제 닫힌 범위(트리거·워크플로·워크스페이스 3자리, 스케줄 자신은 제외)를 명시했다 — plan 서술이 실측보다 넓게 남는 것을 막는 이 저장소의 관례(과거 feedback: "plan 서술은 철회로 거짓이 될 수 있다")를 그대로 따른다.

## 요약

이번 PR 은 `spec/2-navigation` 문서 자체를 바꾸지 않으며(spec_impact: none, 실측), 구현(`TriggersService.remove()`)은 `2-trigger-list.md` §3 "동시 쓰기 직렬화"·§4.3 cascade·§4.4 "동시 삭제 → 404" 에 이미 명문화된 원칙을 그대로 완결시키는 방향으로, 기각된 대안의 재도입이나 합의 원칙 위반, 무근거 결정 번복은 발견되지 않았다. 유일하게 짚을 점은 이번 수정이 의도적으로 남긴 잔여(동일 트리거 동시 DELETE 시 외부 provider teardown 이 두 번 호출될 수 있음)가 spec §4.3 자체의 "남는 창" 목록이 아니라 CHANGELOG·in-progress plan 트래커에만 기록돼 있다는 것인데, 이는 은폐가 아니라 명시적으로 문서화·유예된 스코프 축소이고 §3 의 "외부 호출은 락 밖" 원칙과도 배치되지 않아 INFO 수준을 넘지 않는다.

## 위험도

NONE
