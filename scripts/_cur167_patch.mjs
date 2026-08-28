import fs from 'node:fs';

const path = 'src/components/AddItemModal.tsx';
let source = fs.readFileSync(path, 'utf8');

const replaceOnce = (from, to) => {
  if (!source.includes(from)) throw new Error(`Expected source fragment not found: ${from.slice(0, 80)}`);
  source = source.replace(from, to);
};

const replaceRange = (start, end, replacement) => {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`Start marker not found: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < 0) throw new Error(`End marker not found: ${end}`);
  source = source.slice(0, startIndex) + replacement + source.slice(endIndex);
};

replaceOnce(
  "import { analyzeImage, fetchStoryPrompts, refreshAiEnabled } from '../services/geminiService';\nimport { compressImageForAi } from '../services/imageProcessor';",
  "import { fetchStoryPrompts } from '../services/aiService';\nimport { captureWorkflow, createBatchItem, type CaptureBatchItem } from '../workflows/captureWorkflow';",
);

replaceRange('interface BatchItem {', '\ntype FlowStep =', 'type BatchItem = CaptureBatchItem;\n');

replaceRange(
  '// Helper to filter out null/undefined values from AI-extracted data',
  '\nexport const AddItemModal:',
  '',
);

replaceRange(
  '  const createBatchItem = (image: string, overrides: Partial<BatchItem> = {}): BatchItem => ({',
  '  const handleBatchFileChange =',
  `  const runBatchAnalysis = async (\n    images: string[],\n    existingIds: string[] = [],\n    runId = analysisRunId.current,\n  ): Promise<BatchItem[]> => {\n    if (!currentCollection) return images.map((image) => createBatchItem(image));\n\n    const result = await captureWorkflow.analyzeBatch({\n      images,\n      existingIds,\n      collection: currentCollection,\n      locale: language,\n      isActive: () => analysisRunId.current === runId,\n      shouldStop: () => batchManualRef.current,\n      onProgress: (current, total) => setBatchProgress({ current, total }),\n    });\n\n    if (result.status === 'cancelled') return result.items;\n    if (result.status === 'unavailable') setError(t('aiUnavailableManual'));\n    else if (result.hadError) setError(t('analysisFallback'));\n    if (analysisRunId.current === runId) setAnalysisError(result.hadError);\n    return result.items;\n  };\n\n`,
);

replaceRange(
  '  const analyze = async (base64: string) => {',
  '  const retryAnalysis = () => {',
  `  const analyze = async (base64: string) => {\n    if (!currentCollection) return;\n    const runId = ++analysisRunId.current;\n    setError(null);\n    setAnalysisError(false);\n    setAnalysisRetryable(true);\n    setAnalysisNeedsReview(false);\n    setLowConfidence(false);\n    setTitleError(null);\n    setDetailsOpen(false);\n    setAiFieldSuggestions({});\n    setFormData(createEmptyForm());\n    setStep('analyzing');\n\n    try {\n      const result = await captureWorkflow.analyzeSingle({\n        image: base64,\n        collection: currentCollection,\n        locale: language,\n        isActive: () => analysisRunId.current === runId,\n      });\n      if (result.status === 'cancelled') return;\n      if (result.status === 'unavailable') {\n        setError(t('aiUnavailableManual'));\n        setStep('verify');\n        return;\n      }\n      if (result.status === 'failed') {\n        setAnalysisRetryable(result.retryable);\n        setError(result.retryable ? t('analysisBusyDesc') : t('analysisFailedManual'));\n        setAnalysisError(true);\n        setStep('verify');\n        return;\n      }\n\n      setLowConfidence(result.lowConfidence);\n      setAiFieldSuggestions(result.fieldSuggestions);\n      setFormData({\n        title: result.title,\n        notes: '',\n        data: result.aiDescription ? { _aiDescription: result.aiDescription } : {},\n        rating: 0,\n      });\n      setStep('verify');\n    } catch (error) {\n      console.error(error);\n      if (analysisRunId.current !== runId) return;\n      setError(t('analysisBusyDesc'));\n      setAnalysisError(true);\n      setStep('verify');\n    }\n  };\n\n`,
);

replaceRange(
  '  const handleSave = async () => {',
  '  const renderCollectionSelect = () => (',
  `  const handleSave = async () => {\n    if (isSaving) return;\n    if (!currentCollection) {\n      setError(t('selectCollectionFirst'));\n      recoverMissingCollection();\n      return;\n    }\n    const trimmedTitle = formData.title.trim();\n    if (!trimmedTitle) {\n      setTitleError(t('titleRequired'));\n      titleInputRef.current?.focus();\n      return;\n    }\n    setIsSaving(true);\n    try {\n      const story = formData.notes || '';\n      await captureWorkflow.saveSingle({\n        collectionId: currentCollection.id,\n        onSave,\n        item: {\n          collectionId: currentCollection.id,\n          photoUrl: imagePreview || '',\n          title: trimmedTitle,\n          rating: formData.rating || 0,\n          notes: story,\n          data: formData.data || {},\n        },\n      });\n      trackEvent('item_saved', {\n        mode: 'single',\n        has_story: story.trim().length > 0,\n        has_photo: Boolean(imagePreview),\n        story_length_bucket: storyLengthBucket(story.trim().length),\n      });\n      onClose();\n    } catch (error) {\n      console.error('Save failed:', error);\n      setError(getSaveErrorMessage(error));\n    } finally {\n      setIsSaving(false);\n    }\n  };\n\n  const handleBatchSave = async () => {\n    if (isSaving) return;\n    if (!currentCollection) {\n      setError(t('selectCollectionFirst'));\n      recoverMissingCollection();\n      return;\n    }\n    const missingTitles = batchItems.filter((item) => !item.title.trim());\n    if (missingTitles.length > 0) {\n      const errors = missingTitles.reduce<Record<string, boolean>>((acc, item) => {\n        acc[item.id] = true;\n        return acc;\n      }, {});\n      setBatchTitleErrors(errors);\n      setError(t('batchTitleRequired'));\n      return;\n    }\n    setIsSaving(true);\n    try {\n      await captureWorkflow.saveBatch({\n        collectionId: currentCollection.id,\n        items: [...batchItems],\n        onSave,\n        onItemSaved: (item) => {\n          setBatchItems((prev) => prev.filter((candidate) => candidate.id !== item.id));\n          const story = item.notes || '';\n          trackEvent('item_saved', {\n            mode: 'batch',\n            has_story: story.trim().length > 0,\n            has_photo: Boolean(item.image),\n            story_length_bucket: storyLengthBucket(story.trim().length),\n          });\n        },\n      });\n      onClose();\n    } catch (error) {\n      console.error('Batch save failed:', error);\n      setError(getSaveErrorMessage(error));\n    } finally {\n      setIsSaving(false);\n    }\n  };\n\n`,
);

fs.writeFileSync(path, source);
