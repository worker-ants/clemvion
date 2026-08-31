# 아키텍처(Architecture) 코드 리뷰

## 검토 범위 요약

이번 changeset 은 실질적으로 세 갈래다.

1. **harness 코드** — `consistency_orchestrator.py` 에 `_count_diff_files`/`_scope_delta_census` 신설 + 전용 테스트 `test_consistency_scope_census.py` (`--impl-done` 프롬프트가 예산에 잘려 "구현이 없다"와 "구현이 잘렸다"를 구분 못하던 결함 처방)
2. **backend 코드** — `workflow-assistant.controller.ts` 에 `@ApiUnauthorizedResponse` 6곳 부착 + 회귀 방지 swagger 스펙 테스트 신설, `chat-channel` 3파일의 주석 내 줄 번호 인용 제거(순수 주석)
3. **문서(plan/spec)** — plan 상태 이동(in-progress→complete), 섹션 번호 재정렬, 앵커/줄번호 정정 등 문서 전용 변경 다수(아키텍처 관점 무관)

아키텍처 관점에서 실질적으로 평가 대상이 되는 것은 1·2 뿐이다.

## 발견사항

- **[INFO]** `_scope_delta_census` 가 스코프 필터링 계산·diff 카운팅·한국어 렌더링 문자열 생성 세 책임을 한 함수에 담고 있다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` `_scope_delta_census` 함수 (신설, `_count_diff_files` 바로 아래)
  - 상세: 데이터 계산(scope prefix 매칭, diff 파일/줄 수 집계)과 사람이 읽는 출력 문자열 조립이 분리되지 않아, 테스트가 "값이 맞는가"를 확인하려면 결국 문자열 partial-match 에 의존하게 된다. 실제로 같은 PR 의 테스트 작성 과정에서 이 결합이 문제를 냈다 — `plan/complete/harness-consistency-summary-downgrade-rule.md` 기록에 따르면 최초 단언이 `"0개 파일"` 이라는 숫자만 확인했는데 그 문자열이 scope 줄이 아니라 diff 줄에도 나타나 스코프 필터 파괴 뮤턴트가 생존했다(주어 없는 단언의 fragility). 다만 이 패턴(`_head_basis_notice`, `_omitted_notice` 등 sibling 헬퍼)은 이 모듈 전체의 기존 컨벤션이라, 이번 변경이 새로 만든 결함은 아니다 — 기존 관례를 그대로 따랐을 뿐이다.
  - 제안: 지금 당장 리팩터링을 요구할 정도는 아니나, 이런 "계산+렌더링 결합형 헬퍼"가 이 파일에서 계속 늘어나면(현재도 `_head_basis_notice`/`_omitted_notice`/`_scope_delta_census` 세 개) 계산 결과를 구조화된 값(dict/dataclass)으로 먼저 만들고 렌더링을 별도 함수로 분리하는 편이, 향후 테스트가 "주어 있는 문자열"에 덜 의존하게 해 준다.

- **[INFO]** `workflow-assistant.controller.ts` 에 동일한 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 데코레이터가 라우트마다 반복 부착됐다
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` — `list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage` 6개 지점(diff 상 `@ApiUnauthorizedResponse` 추가 줄들)
  - 상세: 저장소 전체에 이미 이 패턴이 209곳 존재하고(`grep -rn "ApiUnauthorizedResponse" codebase/backend/src/modules/*/*.controller.ts` 로 확인) 클래스 레벨 데코레이터를 쓰는 컨트롤러는 하나도 없다 — 이번 PR 은 그 기존 convention 을 그대로 따른 것이라 회귀는 아니다. 다만 이 PR 이 존재하는 이유 자체가 "@ApiBearerAuth 뒤에 있는 전 라우트가 401 문서화 없이 40개가 넘는 컨트롤러 중 이 하나만 빠져 있었다"(신설 테스트 파일 상단 주석)는 관측이었고, 그 주석 스스로 "저장소 전체를 강제하는 가드는 이 스코프 밖" 이라 인정한다. 즉 라우트 단위 수동 부착에 의존하는 현재 구조는, 새 라우트가 추가될 때 같은 방식으로 다시 빠질 수 있는 구조적 여지를 그대로 남긴다(open-closed 관점에서 "새 라우트 추가"에 닫혀 있지 않음).
  - 제안: 이 PR 범위에서 고칠 필요는 없다(저장소 전체 리팩터가 필요한 별도 작업). 다만 NestJS 의 `applyDecorators()` 로 `@Auth()` 같은 합성 데코레이터를 만들어 `@ApiBearerAuth`+`@ApiUnauthorizedResponse` 를 한 번에 부착하는 안을 향후 후속 항목으로 고려할 만하다 — 이 컨트롤러가 겪은 "게이트가 이 축을 안 본다"는 근본 원인은 데코레이터가 여전히 라우트마다 손으로 반복되는 한 구조적으로 남는다.

- **[INFO]** `_scope_delta_census`/`_head_basis_notice` 등 "HEAD 구역" 콘텐츠는 `truncate_file_bundle` 의 드롭 후보에서 영구 제외되며 크기 상한이 없다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` `collect_context` 의 `--impl-done` 분기 (`target_doc = _head_basis_notice(...) + _scope_delta_census(...) + _splice_chunk(...)`) 및 `truncate_file_bundle` 의 `head, sep, rest = text.partition(_BUNDLE_FILE_SENTINEL)` 처리
  - 상세: `_scope_delta_census` 는 자기 안에서는 `scope_hits[:20]` 로 경계를 두지만, 시스템 차원에서는 "HEAD 구역은 예산 절단 대상이 아니다"라는 설계를 이번에 한 항목 더 늘렸다. 이 설계 자체는 문서화된 의도(드롭 후보에서 제외돼야 절단 여부를 항상 알 수 있다)라 타당하지만, 이런 "항상 보존" 블록이 앞으로도 계속 추가되면 body(spec 폴더 덤프 + diff)에 남는 실질 예산이 그만큼 조용히 줄어드는데, 이 총량을 추적/경고하는 장치는 없다.
  - 제안: 지금 당장 조치가 필요한 결함은 아니다. 다만 HEAD 구역이 세 번째 이상으로 늘어나는 다음 변경에서는, HEAD 총 길이에 대한 상한 또는 관측(로그/경고)을 함께 고려할 만하다.

## 요약

이번 changeset 은 아키텍처 관점에서 위험이 낮다. harness 신설 함수(`_scope_delta_census`)는 순수 함수로 부작용이 없고 기존 모듈의 헬퍼 패턴(작은 텍스트 빌더 함수들의 파이프라인)과 결합도·응집도 면에서 일관되며, 새 순환 의존성이나 레이어 위반은 없다. backend 변경(`@ApiUnauthorizedResponse` 부착)은 저장소 전역의 기존 convention을 그대로 따른 것이고, 신설 swagger 테스트는 기존 공유 테스트 헬퍼(`buildSwaggerDocument`)를 재사용해 보일러플레이트 중복을 피했다(DRY 준수, 공허 테스트 방지용 사전조건 단언 포함). `chat-channel` 3파일 변경은 주석 텍스트뿐이라 구조적 영향이 없다. 나머지 대다수 파일은 plan/spec 문서로 아키텍처 평가 대상이 아니다. 위에 적은 세 건은 모두 INFO 수준의 관찰이며, 기존 컨벤션의 연장선이거나 향후 확장성에 대한 사전 경고 성격이라 이번 PR 을 막을 이유는 없다.

## 위험도

LOW
