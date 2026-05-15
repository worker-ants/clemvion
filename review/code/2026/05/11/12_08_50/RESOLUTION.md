# RESOLUTION — k8s `idea-workflow` → `clemvion` 일괄 리네임

대상 커밋: `9440725a refactor(k8s): idea-workflow → clemvion 일괄 리네임 …`

## 분류 요약

리뷰가 지적한 항목 중 **즉시 조치**(아래 §A)와 **운영자 영역(문서로 가시성 확보)**(§B), **본 PR scope 밖 — 별도 후속**(§C), **false positive**(§D)으로 분류했다.

---

## §A. 즉시 조치 완료

### A1. WARNING #5 — plan 체크리스트 미갱신
- **조치**: `plan/in-progress/k8s-clemvion-rename.md` Phase 1~5 의 모든 완료 항목을 `[x]` 로 갱신. Phase 5 의 마지막 "선택" 한 줄(다른 plan 파일 cross-link)은 의도적으로 미체크 유지.

### A2. INFO #6 — plan 외부 경로 참조
- **조치**: `plan/in-progress/k8s-clemvion-rename.md` 첫 머리에서 외부 plan 경로(`~/.claude/plans/...`) 참조 삭제. 본 저장소 plan 자체로 self-contained.

### A3. INFO #4 — 루트 README "보존 안내" 문구 모호
- **조치**: `README.md` 7행의 `clemvion-` 표기를 명시적 표현으로 다시 씀. "git 저장소 URL 과 코드 디렉터리(`backend/`, `frontend/`) 는 인프라 자산으로 그대로 유지" 로 디렉터리 명을 직접 적시. 도커 이미지 태그는 `clemvion/*` 로 통일됐음을 함께 명기.

### A4. INFO #8 — 구 로컬 docker volume 정리 가이드
- **조치**: `README.md` 풀스택 dev 모드 안내에 한 줄 추가:
  ```
  docker volume ls -q --filter name=^idea-workflow_ | xargs -r docker volume rm
  ```
  이전 버전(`idea-workflow_*`) 볼륨이 남은 환경에서 한 번에 정리 가능.

### A5. WARNING #6 — `DB_DATABASE` 변경 미문서화 + Critical #1·#2·#3 운영자 가이드 통합
- **조치**: `k8s/README.md` 의 "Staging / Prod" 섹션 직후에 **"기존 클러스터 업그레이드 (`idea-workflow` → `clemvion` 전환)"** 표를 신설. 다음 세 가지를 같은 위치에서 참조 가능:
  1. `DB_DATABASE` 변경 (Critical #1) — DB rename 또는 overlay 임시 패치 안내
  2. Deployment selector immutable (Critical #2) — 기존 Deployment 선행 삭제 절차
  3. TLS Secret 이름 (Critical #3) — Secret 복사 one-liner / cert-manager `secretName` 갱신
  이어서 구 Ingress·namespace 정리 명령(WARNING #1·#2)과 OTEL 대시보드 필터 갱신(INFO #3) 안내 추가.

---

## §B. 운영자 영역 (문서 가시성으로만 처리)

리뷰의 Critical 1~3 (DB 단절 / Deployment immutable / TLS Secret 불일치) 과 WARNING #1·#2 (Ingress·namespace orphan), INFO #3 (OTEL 히스토리 단절) 은 모두 **운영자가 클러스터에 적용하는 시점의 절차**라 코드 변경으로 해결할 수 없다. §A5 에서 `k8s/README.md` 에 단계별 표를 추가해 누락 위험을 최소화했다. plan 의 "리스크 메모" 도 같은 내용을 보존.

신규 클러스터 배포에는 해당 없음.

---

## §C. 본 PR scope 밖 — 별도 후속 권장

| # | 리뷰 항목 | 근거 |
| --- | --- | --- |
| W3 | CI 파이프라인 이미지 태그 동기화 | 본 저장소에 `.github/` 가 없음. CI 저장소가 별도면 그쪽 작업으로 분리. plan 리스크 메모에 명기. |
| W4 | cert-manager `Certificate` CR `secretName` 동기화 | cert-manager 리소스가 본 저장소에 없음. README §"기존 클러스터 업그레이드" 표에 명시. |
| W7 | `imagePullPolicy: IfNotPresent` + `:latest` 조합 (보안 패치 갱신 위험) | **기존 문제**. 본 PR 의 리네임 범위 밖. 별도 hardening 작업으로. |
| W8 | NetworkPolicy 부재 | **기존 문제**. 별도 hardening 작업. |
| I1 | namespace 분리 전략(같은 클러스터에 staging/prod 공존 시) | 환경 분리 전제(클러스터별)가 README 에 이미 암시됨. 명시 강화는 별도 docs 작업. |
| I2 | frontend-deployment `fsGroup` / `/tmp` 비대칭 | **기존 문제**. 본 PR 무관. |
| I5 | `frontend/README.md` 패키지 매니저 잔존 | CLAUDE.md 규약 위반은 사실이나 본 PR scope 밖. 별도 정리 작업. |
| I7 | Phase 4 검증을 CI 자동화 | 일회성 마이그레이션 plan 이라 즉시 가치 낮음. 일반 `kubectl kustomize` smoke test 도입은 별도 인프라 plan 으로. |

---

## §D. False positive

### W9 — `docker-compose.yml` volume 이름 정합성 미검증
- 검증 결과: `docker-compose.yml` 에 명시적 `name:` 필드가 없다. Compose 는 이 경우 디렉터리명을 project name 으로 사용 → `clemvion`. README 의 `docker volume rm clemvion_backend_node_modules` 는 정확하다. 추가 조치 불필요.

---

## 검증 재수행

§A 조치 후:

```bash
grep -rn "idea-workflow\|idea_workflow" k8s/ backend/Dockerfile frontend/Dockerfile \
  backend/migrations/Dockerfile backend/migrations/README.md \
  README.md backend/README.md frontend/README.md k8s/README.md
# → 0 라인

kubectl kustomize k8s/overlays/local   > /tmp/local.yaml   && echo OK
kubectl kustomize k8s/overlays/staging > /tmp/staging.yaml && echo OK
kubectl kustomize k8s/overlays/prod    > /tmp/prod.yaml    && echo OK
grep -E "idea-workflow|idea_workflow" /tmp/{local,staging,prod}.yaml || echo "clean"
# → clean
```

(§A 는 README/plan 문서 변경만 추가했으므로 kustomize 산출물은 직전 검증과 동일.)
