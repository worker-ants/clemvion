# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**LOW** — Critical/WARNING 0건. `cross_spec`·`convention_compliance` 가 각각 사소한 INFO(32줄 분류 산수 오차 1줄, 마크다운 중첩 백틱)를 남겼을 뿐, 1·2차 검토가 지적한 Critical 4건·WARNING 2건은 3차 개정(S7~S10 신설)에서 전부 실측 확인 기준으로 해소됐다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | draft 「2차 처분」 32줄 전수 분류 문단에서 `spec/5-system/3-error-handling.md:232`(섹션 헤딩, 키워드 "충돌" 매치) 1줄 누락 — 독립 재현 grep 은 32줄, draft 자체 설명은 31줄로 산수 불일치 | draft 「`--spec` 2차 처분」 문단 | 조치 불요(선택) — 재검토 시 "232행은 스코프 미주장 헤딩이라 비대상" 한 문장 추가 가능 |
| 2 | rationale_continuity | R-CC-19 「degraded 두 경로 닫힌 열거」에 세 번째 경로 후보가 검토·기각된 이력이 `spec/5-system/15-chat-channel.md` 본문에는 전혀 남지 않음 | `spec/5-system/15-chat-channel.md` R-CC-19 절 | 선택 사항(이 draft 의 최소 변경 범위 밖) — S3 나 별도 항목으로 "제3 경로 후보 논의·기각 이력" 한 줄 추가 고려 |
| 3 | convention_compliance | target 문서 S2 diff 지시문이 outer code span 안에 inline code span(백틱)을 중첩해 마크다운 렌더링이 깨질 수 있음 (실제 spec 파일 반영본은 무관, plan 문서의 표현 방식 문제) | target 문서 `## 변경안 › S2` | 소급 수정 선택 사항 — outer code span 대신 코드 펜스 블록 사용 권장 |
| 4 | convention_compliance | S3 부근에서 "CLAUDE.md 자기-반증형 소정정" 을 인용하는 방식이, developer 전용 좁은 예외 조항을 project-planner 의 일반 spec 수정 절차와 유비로만 쓰면서도 오독 여지를 남김 | target 문서 `## 변경안 › S3` 근처 | 선택 사항 — "선례는 `2-trigger-list.md` R-2·`secret-store.md` 취소선+정정 블록 형식이며, CLAUDE.md 조항도 같은 원문 보존 *스타일*" 로 인용 순서 조정 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 1·2차 Critical 4건·WARNING 2건(데이터모델·API규약·에러카탈로그·chat-channel 닫힌 열거·provider 재등록 우회·웹챗 콘솔) 전부 실측 확인 기준 해소. 신규 CRITICAL/WARNING 없음. INFO 1건(32줄 분류 산수 오차) |
| rationale_continuity | NONE | 과거 Rationale(R-CC-19·R-CC-21·R-CC-12(d)·CCH-AD-02·`endpointPath 가변성`·`inline auth path 폐지`) 인용 전부 원문과 정합, 왜곡·무단 재도입 없음. "번복+새 근거" 가 이미 문서 내 존재 |
| convention_compliance | LOW | 마이그레이션 명명(V131/V132)·mixed-transaction 분리·에러 코드 재사용·plan frontmatter·spec 3섹션 구조·리뷰 인용 형식 전부 규약 준수. INFO 2건(마크다운 렌더링, 인용 정밀도) |
| plan_coherence | NONE | 트래커 원 항목의 미해결 결정을 근거와 함께 명시적으로 선택해 해소. 마이그레이션 버전(V131/V132) 선점 없음. chat-channel·다른 in-progress plan 과 활성 충돌 없음 |
| naming_collision | NONE | 신규 식별자는 V131·V132·`idx_trigger_endpoint_path` 뿐이며 전수 grep 결과 미선점 확인. S8~S10 은 기존 표 행의 값(범위)만 치환, 새 식별자 미생성 |

## 권장 조치사항
1. (필수 아님) BLOCK 사유가 없으므로 즉시 조치 불요. Critical/WARNING 0건.
2. (선택) cross_spec INFO — draft 「2차 처분」 32줄 분류 문단에 `3-error-handling.md:232`(비대상 헤딩) 언급 추가.
3. (선택) rationale_continuity INFO — `15-chat-channel.md` R-CC-19 절에 "제3 경로 후보 검토·기각" 이력 한 줄 추가 고려.
4. (선택) convention_compliance INFO 2건 — S2 diff 지시문을 코드 펜스로 변경, S3 근처 CLAUDE.md 인용 문구를 "스타일 유비" 로 명확화.
5. draft 는 spec 반영 전 계획 단계이므로, 실제 S1~S10 적용 후에는 `--impl-prep` 이 아닌 반영본 재검토(필요 시 `--spec` 후속 라운드)로 최종 확인 권장.
