# 발견사항

- **[INFO]** `swagger.md` §3 Rationale 의 정량 근거(요청 116/335·응답 58/128·전체 174/463)를 독립적으로 재현하려 했으나 정확히 일치하지 않았다.
  - 위치: `spec/conventions/swagger.md:426-430` (`### §3 DTO 길이는 왜 강제가 아닌가` 표)
  - 상세: `codebase/backend/src/**/dto/**/*.dto.ts` 를 대상으로 `description:` 필드 길이(40자 초과)를 독립 재집계한 결과 request ≈118/368, response ≈61/185 로 나왔다(문서 주장 116/335, 58/128 과 파일 분류·연결 문자열 처리 방식 차이로 정확히 일치하지 않음, 특히 응답 쪽 비율이 33% vs 문서의 45%). "규칙이 아니다" 라는 **결론의 방향성**(1/3 이상이 40자를 넘는다)은 재현되므로 ③ 결정 자체의 타당성에는 영향이 없다. 다만 정확한 집계 스크립트/기준이 spec 에 남아있지 않아 제3자가 정확히 재현할 수 없다.
  - 제안: 조치 불요(결정 방향에 영향 없음). 다만 향후 유사 실측을 spec 에 인용할 때 집계 스크립트나 정확한 glob/필터 기준을 각주로 남기면 재현성이 높아진다.

- **[INFO]** developer 소유 plan/worktree(`plan/in-progress/swagger-decisions.md` frontmatter `owner: developer`)가 `spec/conventions/swagger.md`(planner 전속 영역)를 같은 세션에서 편집했다. 이는 CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙과 표면적으로 어긋나 보이지만, 이는 이미 12_22_08 라운드의 SUMMARY(#8)·scope/convention-compliance 리뷰어가 "3건의 사용자 판단을 한 턴에 집행하기 위한 의도적 묶음이며 범위 밖 아님"으로 판정한 항목이다. 실제 결과물(swagger.md 개정)도 사용자 결정을 정확히 집행했다.
  - 위치: `plan/in-progress/swagger-decisions.md:6`(frontmatter `owner`), `:21`(③ 표 행)
  - 제안: 이번 라운드에서 재지적하지 않음(기록 유지). 향후 유사 작업에서는 spec 편집분을 별도 planner 턴으로 분리하는 편이 낫다는 기존 권고를 유지.

## 검증한 항목 (결함 없음 확인)

- `ExecuteWorkflowDto.input` 에 `deprecated: true` 추가가 컨트롤러 런타임 병합 로직(`workflows.controller.ts:304-311` `body?.parameterValues ?? input.parameters`, `resolveTriggerParametersRejectingMasked` 단일 호출)과 docstring 서술이 line-level 로 정확히 일치함을 직접 코드 대조로 확인.
- `workflows-execute-body.spec.ts` 10개 테스트 전부 GREEN 재현(`npx jest workflows-execute-body.spec.ts` → 10/10 PASS), TODO/FIXME/HACK/XXX 없음.
- 뮤테이션(`deprecated: true` 제거) 독립 재현 성공 — 신규 `[결정] input 만 deprecated 로 표시된다` 단언만 단독 RED, 나머지 9건 GREEN, `tsc --noEmit` 선검증 통과. `cp` 백업으로 원복 후 `git diff` 로 원상태 확인(RESOLUTION.md 의 뮤테이션 주장이 정확함을 독립 검증).
- 이전 라운드(12_22_08) W1(예외→지시 프레이밍 충돌)·W2(유니코드 오타 `ㆍ`)·W3(plan ③ 서술에 엔드포인트 `description` 축 누락) 세 WARNING 모두 실제 파일에서 fix 반영을 직접 확인:
  - `swagger.md:471` 섹션 제목 및 `:473-481` 이 "예외"→"지시" 재정의와 역사적 각주로 정합화됨.
  - `grep "ㆍ" spec/conventions/swagger.md` 결과 0건(정정 완료).
  - `plan/in-progress/swagger-decisions.md:53-54` 에 "엔드포인트 `description`(50~150자)도 그대로 강제 유지" 문장 존재.
- `scripts/check-doc-links.py --root .` 실행 결과 BROKEN=2 는 모두 이 diff 와 무관한 선존 항목(`1-widget-app.md`, `spec-impl-evidence.md`)이고 `swagger.md` 신규 앵커(`#3-보안정책-캐비엇--왜-길이를-이유로-줄이지-않는가-그리고-왜-양방향인가`)는 실제 헤딩(`swagger.md:471`)과 정확히 일치 — 링크 깨짐 없음.
- EIA `§R17`(spec/5-system/14-external-interaction-api.md:1580)이 `MASKED_VALUE_RESUBMITTED` 규칙의 SoT 로서 `execute`/`re-run` 양쪽을 명시적으로 포함함을 확인 — DTO description 의 "SoT: EIA §R17" 인용이 spec 본문과 일치.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 미체크 항목 수(26)가 plan 문서의 "29 → 26" 주장과 정확히 일치.
- `CHANGELOG.md:1224` 근처 실제로 "스펙 준수 클라이언트에는 영향 없는" 문서/검증 강화 변경을 기록해 온 선례가 존재함을 확인 — documentation 리뷰 INFO#5(CHANGELOG 미기록)의 근거·RESOLUTION 의 "기록 안 함" 처분이 타당한 판단임을 뒷받침.

# 요약

`ExecuteWorkflowDto.input` 에 `deprecated: true` OpenAPI 플래그를 추가하는 것이 실질 코드 변경의 전부이며, 컨트롤러의 `parameterValues ?? input.parameters` 병합 로직·마커 거부(`resolveTriggerParametersRejectingMasked` 단일 호출)와 line-level 로 정확히 일치하고 런타임 동작 무변경임이 기존 캐너리 테스트로 고정돼 있다. 신규 가드 테스트(`[결정] input 만 deprecated 로 표시된다`)는 대조군(`parameterValues` 는 deprecated 아님)까지 포함해 결정을 정확히 고정하며, 독립 뮤테이션 재현으로 유효성을 확인했다. `spec/conventions/swagger.md` §3 개정도 계획 문서·트래커의 3건 사용자 결정과 1:1 대응하고, 직전 리뷰 라운드(12_22_08)가 지적한 WARNING 3건(예외/지시 프레이밍 충돌·유니코드 오타·plan ③ 서술 누락)이 모두 정확히 반영됐음을 코드·문서 직접 대조로 검증했다. 앵커 링크 무결성·EIA §R17 spec 정합성도 확인됐다. 유일하게 남는 것은 spec Rationale 의 정량치가 독립 재현 시 정확히 일치하지 않는 낮은 심각도의 재현성 문제(결론 방향에는 영향 없음)와, 이미 다른 리뷰어들이 범위 밖 아님으로 판정한 developer/planner 경계 관련 기록 사항뿐이다. 요구사항 충족·spec fidelity 관점에서 병합을 막을 결함은 없다.

# 위험도
NONE
