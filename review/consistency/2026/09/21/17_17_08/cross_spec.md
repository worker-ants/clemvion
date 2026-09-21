# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-done, `modelconfig-dup-delete`)

## 컨텍스트 보정

번들 프롬프트는 예산 초과로 target 영역(`spec/2-navigation`) 15개 파일 중 3개(`1-workflow-list.md`·
`2-trigger-list.md`·`3-schedule.md`)만 전문이 실렸고, 이번 변경이 실제로 걸리는 `6-config.md`
(Part B: Model Config), 관련 spec(`5-system/1-auth.md`·`5-system/3-error-handling.md`·
`data-flow/1-audit.md`·`1-data-model.md` 등), 그리고 **diff 본문 자체**까지 전부 절단됐다
(`<git diff origin/main...HEAD -- code_areas>` 가 "생략된 파일" 목록에 그대로 등재). 아래 판단은
프롬프트가 아니라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/modelconfig-dup-delete-4b8e2d`)
를 절대경로로 직접 `git diff`/`Read`/`grep` 한 결과다.

## 대상 변경 범위 (실측)

`git diff origin/main...HEAD --stat` 기준 코드 변경은 3파일:

- `codebase/backend/src/modules/model-config/model-config.service.ts` (34줄) — `remove()` 를
  무락 `findEntity` → `repo.remove(entity)` 에서 무락 `findEntity` → **원자적 `repo.delete({id, workspaceId})`
  의 `affected` 판정**으로 전환. `affected === 0` 이면 `notFound()`(`MODEL_CONFIG_NOT_FOUND`, 404)
  를 던지고 `notifyInvalidated`/`recordAudit` 를 건너뛴다.
- `model-config.service.spec.ts` (86줄) — mock 을 `remove`→`delete` 로 이설, 동시 삭제 진 쪽
  회귀 테스트 2건(`affected:0` → 404·무통지·무감사, `affected: undefined|null` → 정상 삭제 처리)
  추가.
- `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (신규 125줄) — `SELECT …
  FOR UPDATE` 로 겹침을 만들고 `[204, 404]` + 감사 1건을 단언하는 e2e.

`plan/in-progress/modelconfig-dup-delete.md` 에 적힌 처방과 실제 diff 가 **정확히 일치**한다
(락 없음 전제, `MODEL_CONFIG_NOT_FOUND` 재사용, `remove→delete` 전환 근거인 cascade/hook 부재
주장 등). 이 스코프는 이미 같은 세션의 `--impl-prep` 라운드
(`review/consistency/2026/09/21/16_16_35/cross_spec.md`)에서 동일 처방을 대상으로 감사
액션명·404 코드·RBAC·FK cascade 방향·락 설계 부재·캐시 무효화 계약 6항목을 교차 검증했고
CRITICAL/WARNING 없음으로 수렴한 바 있다. 이번 impl-done 라운드는 그 검증이 여전히 유효한지
(구현이 plan 을 이탈하지 않았는지) + impl-prep 이 남긴 WARNING 1건의 후속 처리 여부를 확인한다.

## 발견사항

교차 검증 결과 — CRITICAL/WARNING 없음:

- **impl-prep WARNING 1건 해소 확인** — 16_16_35 라운드는 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  의 옴니버스 트래커 위치 열거가 `6-config.md §Model Config API (DELETE /api/model-configs/:id)`
  를 누락한다고 지적했다. `git diff origin/main...HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md`
  로 실측한 결과, 해당 열거에 `**`6-config.md` §Model Config API(`DELETE /api/model-configs/:id`)**`
  항목이 실제로 추가됐고, "`6-config.md` 한 파일 안에 두 행" 주의문도 함께 달렸다 — 지적된
  갭이 실제로 메워졌다.
- **404 에러 코드 정의 재확인** — `spec/5-system/3-error-handling.md` 의 `MODEL_CONFIG_NOT_FOUND`
  행이 "지정 id 의 ModelConfig 부재 또는 cross-kind 접근 차단(존재 누설 방지)" 을 404 로 정의한다.
  구현의 진 쪽 분기(`affected === 0` → `notFound()`)는 "재조회 시점에 이미 없어진 리소스" 이므로
  이 정의의 부분집합이며, 형제 6건이 쓰는 범용 `RESOURCE_NOT_FOUND` 대신 도메인 코드를 유지한
  plan §C 의 선택이 spec 정의와 어긋나지 않는다.
- **감사 액션 이름 재확인** — `spec/data-flow/1-audit.md` 에 `model_config.delete` 가 이미
  `model-config/model-config.service.ts` 발행으로 등재돼 있다. 이번 수정은 액션 이름·리소스
  타입을 바꾸지 않고 "몇 번 남는가" 만 고치므로 갱신할 문장이 없다.
- **RBAC 재확인** — `6-config.md:272` "mutation(POST/PATCH/DELETE)은 Editor+" 서술과
  `5-system/1-auth.md` 의 리소스별 권한 매트릭스가 일치한다(16_16_35 확인 유지, 이번 diff 는
  가드를 건드리지 않음). 신규 e2e 는 team workspace owner 토큰으로 호출하므로 Editor+ 조건을
  자연히 만족한다.
- **FK cascade 방향 재확인** — `spec/1-data-model.md` §2.11(KnowledgeBase) 의
  `rerank_config_id`/`extraction_llm_config_id`/`rerank_llm_config_id` 모두 `FK → ModelConfig
  (SET NULL)` 로 명시돼 있다. `repo.remove(entity)` → `repo.delete(criteria)` 전환이 cascade
  방향을 바꿀 위험(형제 자리에서 실제 있었던 CASCADE 오인 함정)이 이 엔티티에는 적용되지
  않는다는 plan 의 주장과 데이터 모델이 일치한다.
- **API 계약 형태 재확인** — 신규 e2e 의 `POST /api/model-configs` body(`kind`/`provider`/`name`/
  `apiKey`/`defaultModel`/`defaultParams`/`isDefault`)와 `DELETE /api/model-configs/:id` 는
  `6-config.md` §3 API 표(276~284행)에 정의된 엔드포인트·필드와 형태가 일치한다. 응답 코드
  204(성공)/404(진 쪽)도 컨트롤러 관례(`@HttpCode(204)`)와 부합한다.
- **테스트만의 변경(spec 무관) 확인** — `.spec.ts` 의 mock 전환(`mockRepo.remove` →
  `mockRepo.delete`)과 "TypeORM `remove` 가 id 를 지운다" 흉내 제거는 순수 테스트 리팩터로,
  어떤 spec 문서의 서술과도 접점이 없다.

위 항목 모두 CRITICAL/WARNING 없음. 아래는 참고용 INFO(비차단, 신규 발견 아님 — 16_16_35 가
이미 등재한 항목의 연속 관찰).

- **[INFO]** "무락 삭제 + 원자적 DELETE affected 판정" 패턴이 8번째로 반복 확정됐으나 여전히
  `spec/conventions/` 에 명문화되지 않음
  - target 위치: 없음 (구현 완료로 이 패턴의 등장 횟수만 8 → 확정, 서술 부재는 그대로)
  - 충돌 대상: 없음 — 충돌이 아니라 부재
  - 상세: 16_16_35 가 이미 이 관찰을 INFO 로 기록했다. 이번 impl-done 시점에 코드가 실제로
    착지했으므로, 트래커가 명시한 "아홉 번째(WebAuthn) 착수 시점에 공용 헬퍼/컨벤션 문서화
    여부를 실제로 결정한다" 는 선행 조건이 이제 유효해졌다는 점만 갱신 사항이다.
  - 제안: 조치 불요(이번 PR 범위 아님, 트래커에 이미 조건이 명시돼 있음).

## 요약

이번 impl-done 대상은 `ModelConfigService.remove()` 의 동시 DELETE 중복 감사 로그 결함을
원자적 `DELETE`+`affected` 판정으로 고치는 코드 전용 수정(spec 본문 변경 없음, `spec_impact:
none`)이며, 실제 diff(3파일/245줄, 신규 e2e 포함)가 같은 세션의 `--impl-prep` 라운드가 검증한
plan 처방과 정확히 일치한다. 404 에러 코드(`MODEL_CONFIG_NOT_FOUND`)·감사 액션명
(`model_config.delete`)·RBAC(Editor+)·FK cascade 방향(SET NULL)·API 계약 형태를 워킹트리에서
직접 재확인한 결과 모두 기존 spec 정의와 일치하며, impl-prep 이 남긴 유일한 WARNING(옴니버스
트래커 위치 열거 누락)도 diff 상 실제로 해소됐음을 확인했다. Cross-spec 관점에서 이 변경을
차단할 사유는 없다.

## 위험도

NONE
